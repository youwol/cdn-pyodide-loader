import {
    InstallInputs,
    CdnMessageEvent,
    InstallLoadingGraphInputs,
} from '@youwol/cdn-client'
import { loadPyodide } from 'pyodide'

export interface InstallOptions {
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

type PythonLoadingGraph = InstallLoadingGraphInputs & InstallOptions
type PythonInstall = InstallInputs & InstallOptions

function isPythonInstallInputs(
    body: PythonInstall | PythonLoadingGraph,
): body is PythonInstall {
    return (body as PythonInstall).modules !== undefined
}

export async function install(inputs: PythonInstall | PythonLoadingGraph) {
    const onEvent =
        inputs.onEvent ||
        (() => {
            /*no op*/
        })
    if (!isPythonInstallInputs(inputs)) {
        throw Error('Install from lock file not implemented')
    }
    onEvent(
        new CdnMessageEvent(
            `pyodide runtime`,
            `Installing python runtime`,
            'Pending',
        ),
    )

    const modules = inputs.modules
    const pyodide = await loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.21.3/full',
    })
    if (inputs.exportedPyodideInstanceName) {
        window[inputs.exportedPyodideInstanceName] = pyodide
    }
    onEvent(
        new CdnMessageEvent(
            `pyodide runtime`,
            `Python runtime installed`,
            'Succeeded',
        ),
    )
    onEvent(
        new CdnMessageEvent(
            'loadDependencies',
            'Loading Python dependencies...',
            'Pending',
        ),
    )
    await pyodide.loadPackage('micropip')

    modules.forEach((module) => {
        onEvent(
            new CdnMessageEvent(
                `${module}`,
                `${module} installing ...`,
                'Pending',
            ),
        )
    })

    await Promise.all(
        modules.map((module) => {
            return pyodide
                .runPythonAsync(
                    `
import micropip
await micropip.install(requirements='${module}')`,
                )
                .then(() => {
                    onEvent(
                        new CdnMessageEvent(
                            `${module}`,
                            `${module} loaded`,
                            'Succeeded',
                        ),
                    )
                })
        }),
    )

    onEvent(
        new CdnMessageEvent(
            'loadDependencies',
            'Python dependencies loaded',
            'Succeeded',
        ),
    )

    const lock = await pyodide.runPythonAsync(
        'import micropip\nmicropip.freeze()',
    )
    return { pyodide, loadingGraph: lock }
}
