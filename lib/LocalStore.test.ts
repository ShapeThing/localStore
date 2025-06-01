import { expect, test } from 'vitest'
import { LocalStore } from './LocalStore'
import { QueryEngine } from '@comunica/query-sparql'

test('query on localStore', async () => {
  const store = new LocalStore()
  await store.mount()
  const engine = new QueryEngine();

//   const results = await engine.queryQuads(``, {
//     sources: [store]
//   })
})