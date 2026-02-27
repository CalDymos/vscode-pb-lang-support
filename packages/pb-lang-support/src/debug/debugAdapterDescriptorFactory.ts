import * as vscode from 'vscode';
import * as path from 'path';

export class PureBasicDebugAdapterDescriptorFactory
    implements vscode.DebugAdapterDescriptorFactory
{
    constructor(private readonly context: vscode.ExtensionContext) {}

    createDebugAdapterDescriptor(
        _session: vscode.DebugSession,
        _executable: vscode.DebugAdapterExecutable | undefined,
    ): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
        const adapterPath = this.context.asAbsolutePath(
            path.join('out', 'debug', 'debugAdapter.js'),
        );

        const nodeArgs =
            process.env['PUREBASIC_DEBUG_ADAPTER'] === '1'
                ? ['--nolazy', '--inspect-brk=6010', adapterPath]
                : [adapterPath];

        return new vscode.DebugAdapterExecutable('node', nodeArgs);
    }
}