# LocalStore

A RDF/js Store that reads relative turtle files from disk and mutates them via a QueryEngine such as Comunica.

## How to use:

```TypeScript

import { LocalStore } from '@shapething/localstore'
const store = new LocalStore({
  baseUri: new URL('http://example.com/')
})
```
