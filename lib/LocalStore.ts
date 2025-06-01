import type {
  DefaultGraph,
  NamedNode,
  Quad,
  Source,
  Stream,
  Term,
} from "@rdfjs/types";
import { get, set } from "idb-keyval";
/** @ts-ignore */
import { Readable } from "readable-stream";
import factory from "@rdfjs/data-model";
import { Parser, Store } from "n3";
import { getFileHandleByPath } from "./helpers/getFileHandleByPath";
import { getAllFilesFromDirectory } from "./helpers/getAllFilesFromDirectory";
import Hex from "hex-encoding";

type LocalStoreOptions = {
  baseUri: URL;
};

export class LocalStore implements Source {
  #directoryHandle?: FileSystemDirectoryHandle;
  #baseUri: URL;
  #cache: Store = new Store();
  #inFlightCachePromises: Map<string, Promise<void>> = new Map();

  constructor({ baseUri }: LocalStoreOptions) {
    this.#baseUri = baseUri;
  }

  /**
   * Connects to a previously mounted folder when given its name,
   * or show a directory picker to connect to a folder.
   */
  async mount(name?: string) {
    try {
      const mounts: Set<string> = (await get("mounts")) ?? new Set();

      if (name && mounts.has(name)) {
        this.#directoryHandle = await get(name);
        return;
      }

      if (name && !mounts.has(name)) {
        console.info(
          `Could not find connection to folder ${name}, please connect again.`
        );
      }

      this.#directoryHandle = await globalThis.showDirectoryPicker();
      await set(this.#directoryHandle.name, this.#directoryHandle);
      mounts.add(this.#directoryHandle.name);
      set("mounts", mounts);
    } catch (error: any) {
      console.log(error);
    }
  }

  match(
    subject?: Term | null,
    predicate?: Term | null,
    object?: Term | null,
    graph?: Term | null
  ): Stream<Quad> {
    if (!this.#directoryHandle) throw new Error(`Local store not mounted`);

    const stream = new Readable({ objectMode: true });

    stream._read = async () => {
      const graphIterator = graph
        ? ([graph] as [NamedNode])
        : this.getNamedGraphs();

      let graphIterations = 0;
      let graphIterationsEnded = 0;

      for await (const graph of graphIterator) {
        graphIterations++;

        if (!this.#graphIsCached(graph)) await this.#cacheGraph(graph);
        const graphStream = this.#cache.match(
          /** @ts-ignore */
          subject,
          predicate,
          object,
          graph
        );

        graphStream.on("data", (quad: Quad) => stream.push(quad));

        graphStream.on("end", () => {
          graphIterationsEnded++;
          if (graphIterations === graphIterationsEnded) {
            stream.push(null);
          }
        });
      }
    };

    return stream;
  }

  #graphIsCached(graph: NamedNode) {
    /** @ts-expect-error we are using N3s internal API */
    return this.#cache._termToNumericId(graph) !== undefined;
  }

  async #cacheGraph(graph: NamedNode) {
    const fileHandle = await this.#graphToFileHandle(
      graph as NamedNode | DefaultGraph
    );
    if (!fileHandle) return;

    if (!this.#inFlightCachePromises.has(graph.value)) {
        const promise = this.#parseGraph(graph, fileHandle);
        this.#inFlightCachePromises.set(graph.value, promise);
        promise.then(() => {
            this.#inFlightCachePromises.delete(graph.value);
        })
    }

    return this.#inFlightCachePromises.get(graph.value)
  }

  async #parseGraph(graph: NamedNode, fileHandle: FileSystemFileHandle) {
    const parser = new Parser({ baseIRI: graph.value });
    const contents = await (await fileHandle.getFile()).text();
    const quads = await parser.parse(contents);
    this.#cache.addQuads(
      quads.map((quad) =>
        factory.quad(quad.subject, quad.predicate, quad.object, graph)
      )
    );
  }

  async *getNamedGraphs(): AsyncIterable<NamedNode> {
    for await (const [graph] of this.#getNamedGraphsWithFileHandle()) {
      yield graph;
    }
  }

  async *#getNamedGraphsWithFileHandle(): AsyncIterable<
    [NamedNode, FileSystemFileHandle]
  > {
    if (!this.#directoryHandle) throw new Error(`Local store not mounted`);

    for await (const [path, entry] of getAllFilesFromDirectory(
      this.#directoryHandle
    )) {
      const graph = this.#pathAndFileHandleToGraph(path);
      yield [graph, entry];
    }
  }

  #pathAndFileHandleToGraph(path: string): NamedNode {
    const cleanedPath = path.substring(0, path.length - 4);
    const parts = cleanedPath.split("/");
    const filename = parts.pop()!;

    if (Hex.is(filename)) {
      const decoded = Hex.decodeStr(filename);
      return factory.namedNode(decoded);
    }

    return factory.namedNode(new URL(cleanedPath, this.#baseUri).toString());
  }

  async #graphToFileHandle(
    graph: NamedNode | DefaultGraph
  ): Promise<FileSystemFileHandle | undefined> {
    if (!this.#directoryHandle) throw new Error(`Local store not mounted`);

    /**
     * Relative named graphs
     */
    if (graph.value.startsWith(this.#baseUri.toString())) {
      const filename = `${graph.value.replace(
        this.#baseUri.toString(),
        ""
      )}.ttl`;

      try {
        return getFileHandleByPath(filename, this.#directoryHandle);
      } catch {}

      /**
       * The default graph
       */
    } else if (graph.termType === "DefaultGraph") {
      return getFileHandleByPath("default-graph.ttl", this.#directoryHandle);

      /**
       * A graph that is not starting with our base name.
       */
    } else {
      const uint8 = new TextEncoder().encode(graph.value);
      const encoded = Hex.encode(uint8);
      const filename = `${encoded}.ttl`;
      return getFileHandleByPath(filename, this.#directoryHandle);
    }
  }
}
