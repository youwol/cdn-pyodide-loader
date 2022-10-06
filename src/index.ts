import {
    Client,
    InstallInputs,
    State,
    CdnMessageEvent,
    CdnEvent,
    CdnLoadingGraphErrorEvent,
    FetchErrors,
    getUrlBase,
    sanitizeModules,
} from '@youwol/cdn-client'
import { loadPyodide } from 'pyodide'

export interface PythonInstall extends InstallInputs {
    warmUp: boolean
}

export async function install(inputs: PythonInstall) {
    const cdnClient = new Client()
    const modules = sanitizeModules(inputs.modules || [])
    const onEvent =
        inputs.onEvent ||
        (() => {
            /*no op*/
        })
    const body = {
        modules: modules,
    }

    const loadingGraph = await cdnClient.queryLoadingGraph(body)
    const libraries = loadingGraph.lock.reduce(
        (acc, e) => ({ ...acc, ...{ [e.id]: e } }),
        {},
    )
    const librariesByName = loadingGraph.lock.reduce(
        (acc, e) => ({ ...acc, ...{ [e.name]: e } }),
        {},
    )

    const errors = []
    const packagesSelected = loadingGraph.definition
        .flat()
        .map(([assetId, cdn_url]) => {
            return {
                assetId,
                url: `/api/assets-gateway/raw/package/${cdn_url}`,
                name: libraries[assetId].name,
                version: libraries[assetId].version,
                exportedSymbol: libraries[assetId].exportedSymbol,
            }
        })
        .filter(
            ({ name, version }) =>
                !State.isCompatibleVersionInstalled(name, version),
        )

    await Promise.all(
        packagesSelected.map(({ name, url }) => {
            return cdnClient
                .fetchScript({
                    name,
                    url,
                    onEvent,
                })
                .catch((error) => {
                    errors.push(error)
                })
        }),
    )
    if (errors.length > 0) {
        onEvent(new CdnLoadingGraphErrorEvent(new FetchErrors({ errors })))
        throw new FetchErrors({ errors })
    }

    onEvent(new CdnMessageEvent('loadPyodide', 'Loading Python environment...'))
    window['loadedPyodide'] = await loadPyodide({
        indexURL: getUrlBase('pyodide', '0.21.3') + '/full',
    })
    const pyodide = window['loadedPyodide']

    onEvent(new CdnMessageEvent('loadPyodide', 'Python environment loaded'))

    const packageInstallPromises = packagesSelected
        .filter(({ name }) => name != '@pyodide/distutils')
        .map(({ url }) => {
            url = url.includes('CLAPACK') ? 'CLAPACK' : url
            return pyodide.loadPackage(url, (message) =>
                processInstallMessages(message, onEvent),
            )
        })
    await Promise.all(packageInstallPromises)
    if (inputs.warmUp) {
        modules.forEach(({ name }) => {
            const lib = librariesByName[name]
            const importName =
                name == lib.exportedSymbol
                    ? lib.exportedSymbol.split('pyodide/')[1]
                    : lib.exportedSymbol

            onEvent(
                new CdnMessageEvent(
                    importName,
                    `${name} (${importName}) warming up...`,
                ),
            )
            pyodide.runPython(`import ${importName}`)
            onEvent(
                new CdnMessageEvent(
                    importName,
                    `${name} (${importName}) loaded & ready`,
                ),
            )
        })
    }
    return { pyodide, loadingGraph }
}

export function processInstallMessages(
    rawMessage: string,
    onEvent: (event: CdnEvent) => void,
): [] {
    if (
        rawMessage.startsWith('Loading') &&
        !rawMessage.includes('/api/assets-gateway')
    ) {
        const packages = rawMessage.split('Loading ')[1].split(', ')

        packages.forEach((library) => {
            onEvent(new CdnMessageEvent(library, `${library} queued`))
        })
        return
    }
    if (
        rawMessage.startsWith('Loading') &&
        rawMessage.includes('/api/assets-gateway')
    ) {
        const library = rawMessage.split(' ')[1]
        onEvent(new CdnMessageEvent(library, `${library} loading...`))
        return
    }
    if (rawMessage.startsWith('Loaded')) {
        const packages = rawMessage.split('Loaded ')[1].split(', ')
        packages.forEach((library) => {
            onEvent(new CdnMessageEvent(library, `${library} loaded`))
        })
    }
}
