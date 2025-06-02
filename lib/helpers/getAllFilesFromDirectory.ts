export async function* getAllFilesFromDirectory(
  handle: FileSystemDirectoryHandle,
  parentPath: string = '.',
  skipList: string[] = []
): AsyncIterable<[string, FileSystemFileHandle]> {
  /** @ts-ignore Deno publish does not pick up the types */
  for await (const entry of handle.values()) {
    if (entry.kind === 'file' && entry.name.endsWith('.ttl')) {
      yield [`${parentPath}/${entry.name}`, entry]
    } else if (entry.kind === 'directory') {
      if (skipList.includes(entry.name)) continue
      for await (const [path, childEntry] of getAllFilesFromDirectory(entry, `${parentPath}/${entry.name}`, skipList)) {
        yield [path, childEntry]
      }
    }
  }
}
