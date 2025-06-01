export const persistMount = async (directoryHandle: FileSystemDirectoryHandle) => {
    const DBOpenRequest = indexedDB.open('persist-mount', 1)

    DBOpenRequest.onupgradeneeded = event => {
      if (event.oldVersion === 0) DBOpenRequest.result.createObjectStore('persist-mount', {})
    }

    DBOpenRequest.onblocked = () => console.info('IndexedDB open database request was blocked')
    DBOpenRequest.onsuccess = () => console.log(DBOpenRequest.result)
}