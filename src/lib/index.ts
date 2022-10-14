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
    LightLibraryQueryString,
    getAssetId,
} from '@youwol/cdn-client'
import { loadPyodide } from 'pyodide'

export interface PythonInstall extends InstallInputs {
    /**
     * List of modules to install, see [[LightLibraryQueryString]] for specification.
     *
     * A typical example (looking at the field 'installInputs'):
     * ```
     * import {install} from `@youwol/cdn-client`
     *
     * await install({
     *     customInstallers:[
     *         module:'@youwol/cdn-pyodide-loader,
     *         installInputs:{
     *             modules: ['numpy#^1.22.4']
     *         }
     *     ]
     * })
     * ```
     */
    modules: LightLibraryQueryString[]

    /**
     * If provided, export the instantiated pyodide interpreter in global `window` using this name
     */
    exportedPyodideInstanceName?: string

    /**
     * If true it will import the package in python at the end of the installation.
     */
    warmUp?: boolean

    /**
     * If provided, forward CdnEvent to this callback.
     *
     * @param cdnEvent cdn event
     */
    onEvent?: (cdnEvent) => void
}

export async function install(
    inputs: PythonInstall,
    mockPyodide?: {
        loadPyodide: () => Promise<{ loadPackage; runPython }>
    },
) {
    const cdnClient = new Client()
    // There is some trouble when pyodide is loaded from an iFrame programmatically constructed (no origin available)
    // We provide absolute URL to pyodide by finding the first parent of the current window having an origin defined.
    const getOrigin = (currentWindow: Window) => {
        return currentWindow.document.location.origin == 'null'
            ? getOrigin(currentWindow.parent)
            : currentWindow.document.location.origin
    }

    const origin = getOrigin(window)
    const indexURL = `${origin}${getUrlBase('pyodide', '0.21.3')}/full`
    const nativePackages = {
        '@pyodide/distutils': 'distutils',
        '@pyodide/CLAPACK': 'CLAPACK',
    }
    const modules = sanitizeModules(inputs.modules || [])
    const onEvent =
        inputs.onEvent ||
        (() => {
            /*no op*/
        })
    const loadingGraph = await cdnClient.queryLoadingGraph({
        modules: modules,
    })
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
            const isNative = Object.keys(nativePackages).find(
                (name) => getAssetId(name) == assetId,
            )
            return {
                assetId,
                url: isNative
                    ? `${getUrlBase('pyodide', '0.21.3')}/full/${
                          cdn_url.split('/').slice(-1)[0]
                      }`
                    : `/api/assets-gateway/raw/package/${cdn_url}`,
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
    const pyodide = mockPyodide
        ? await mockPyodide.loadPyodide()
        : await loadPyodide({
              indexURL,
          })

    if (inputs.exportedPyodideInstanceName) {
        window[inputs.exportedPyodideInstanceName] = pyodide
    }

    onEvent(new CdnMessageEvent('loadPyodide', 'Python environment loaded'))

    const packageInstallPromises = packagesSelected.map(({ name, url }) => {
        url = nativePackages[name] ? nativePackages[name] : `${origin}${url}`
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
