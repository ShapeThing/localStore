import { LocalStore } from "../lib/LocalStore";
import { QueryEngine } from "@comunica/query-sparql";

const store = new LocalStore({
  baseUri: new URL("http://example.com/"),
});

document.querySelector("#mount-store")?.addEventListener("click", async () => {
  await store.mount("example");
});

document.querySelector("#graphs")?.addEventListener("click", async () => {
    for await (const graph of store.getNamedGraphs()) {
      console.log(graph);
  }
});

document.querySelector("#query")?.addEventListener("click", async () => {
  const engine = new QueryEngine();
  const quadsStream = await engine.queryQuads(
    `construct { ?s ?p ?o } where { 
        { graph <http://example.com/lorem> { ?s ?p ?o } } union
        { graph <https://shapething.com/lorem> { ?s ?p ?o } } union
        { graph <http://example.com/ipsum> { ?s ?p ?o } }
    }`,
    {
      sources: [store],
    }
  );

  const quads = await quadsStream.toArray();
  console.log(quads);
});
