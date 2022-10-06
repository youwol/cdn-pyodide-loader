import { AssetsGateway, ExplorerBackend } from '@youwol/http-clients'
import { LocalYouwol, RootRouter } from '@youwol/http-primitives'
import { mergeMap, take, reduce, tap } from 'rxjs/operators'
import { from } from 'rxjs'
import { readFileSync } from 'fs'

import { Client } from '@youwol/cdn-client'
import path from 'path'

export class MockPyodide {
    runs = []
    packages = []
    loadPyodide() {
        return Promise.resolve({
            runPython: (cmd) => {
                this.runs.push(cmd)
            },
            loadPackage: (module) => {
                return Promise.resolve(this.packages.push(module))
            },
        })
    }
}
/**
 *
 * @param packages path (string) from 'tests' directory (e.g. './packages/root.zip')
 */
export function installPackages$(packages: string[]) {
    return LocalYouwol.setup$({
        localOnly: true,
        email: 'int_tests_yw-users@test-user',
        pyYouwolPort: 2001,
    }).pipe(
        tap(() => {
            console.log(RootRouter.HostName)
            Client.HostName = RootRouter.HostName
        }),
        mergeMap(() => {
            const assetsGtw = new AssetsGateway.AssetsGatewayClient()
            return assetsGtw.explorer.getDefaultUserDrive$()
        }),
        mergeMap((resp: ExplorerBackend.GetDefaultDriveResponse) => {
            return from(
                packages.map((zipPath) => ({
                    folderId: resp.homeFolderId,
                    zip: zipPath,
                })),
            )
        }),
        mergeMap(({ folderId, zip }) => {
            const assetsGtw = new AssetsGateway.AssetsGatewayClient()
            const buffer = readFileSync(path.resolve(__dirname, zip))
            const arraybuffer = Uint8Array.from(buffer).buffer

            return assetsGtw.cdn
                .upload$({
                    queryParameters: { folderId },
                    body: { fileName: zip, blob: new Blob([arraybuffer]) },
                })
                .pipe(take(1))
        }),
        reduce((acc, e) => [...acc, e], []),
    )
}
