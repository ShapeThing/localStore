import { nonNullable } from "./nonNullable";

const getHandleByPath = async (
  path: string,
  root: FileSystemDirectoryHandle
): Promise<any> => {
  const pathParts = path.split("/").filter(nonNullable);
  let nextPathPart = pathParts.shift();
  let pointer: FileSystemDirectoryHandle = root;

  while (pointer && nextPathPart) {
    try {
      pointer = await pointer.getDirectoryHandle(nextPathPart);
    } catch (exception) {
      try {
        /** @ts-expect-error When we get here the type changes */
        pointer = await pointer.getFileHandle(nextPathPart);
      } catch {}
    }
    nextPathPart = pathParts.shift();
  }

  return pointer as unknown as FileSystemFileHandle;
};

export const getFileHandleByPath = async (
  path: string,
  root: FileSystemDirectoryHandle
): Promise<FileSystemFileHandle | undefined> => {
  const result = await getHandleByPath(path, root);
  // The file did not exists and we are left with a directory.
  if (result.kind !== "file") return undefined
  return result;
};

export const getDirectoryHandleByPath = async (
  path: string,
  root: FileSystemDirectoryHandle
): Promise<FileSystemDirectoryHandle> => {
  const result = await getHandleByPath(path, root);
  if (result.kind !== "directory") throw new Error("Was expecting a directory");
  return result;
};
