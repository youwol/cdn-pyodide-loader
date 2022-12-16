// eslint-disable-next-line eslint-comments/disable-enable-pair -- to not have problem
/* eslint-disable jest/no-done-callback -- eslint-comment Find a good way to work with rxjs in jest */
import 'isomorphic-fetch'

if (!globalThis.fetch) {
    globalThis.fetch = fetch
    globalThis.Headers = Headers
    globalThis.Request = Request
    globalThis.Response = Response
}

import { installPackages$, MockPyodide } from './common'
import { install } from '../lib'
import { install as cdnInstall } from '@youwol/cdn-client'

// installing pyodide in the CDN takes a bit of time
jest.setTimeout(60 * 1000)

beforeAll((done) => {
    installPackages$(['./data/pyodide.zip', './data/numpy.zip']).subscribe(
        () => {
            done()
        },
    )
})

test('install numpy', async () => {
    const window = await cdnInstall({
        modules: ['pyodide#^0.21.3'],
    })

    expect(window['pyodide']).toBeTruthy()
    await install(
        { modules: ['@pyodide/numpy#^1.22.4'], warmUp: true },
        new MockPyodide(),
    )
})
