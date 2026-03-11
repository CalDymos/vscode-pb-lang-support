/**
 * Signature help provider
 * Provides function parameter hint functionality for PureBasic
 */

import {
    SignatureHelp,
    SignatureInformation,
    ParameterInformation,
    TextDocumentPositionParams
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { getModuleFunctionCompletions as getModuleFunctions } from '../utils/module-resolver';
import { getActiveUsedModules } from '../utils/scope-manager';
import { escapeRegExp} from '../utils/pb-lexer-utils';
import { ApiFunctionListing } from '../utils/api-function-listing';
import { findBuiltin } from '../utils/builtin-functions';

/**
 * Handle signature help request
 */
export function handleSignatureHelp(
    params: TextDocumentPositionParams,
    document: TextDocument,
    documentCache: Map<string, TextDocument>,
    apiListing?: ApiFunctionListing
): SignatureHelp | null {
    const position = params.position;
    const text = document.getText();
    const lines = text.split('\n');
    const currentLine = lines[position.line] || '';
    const linePrefix = currentLine.substring(0, position.character);

    // Find function call (supports Module::Func and Func)
    const functionCall = findFunctionCall(linePrefix);
    if (!functionCall) {
        return null;
    }

    // Find function definition
    let functionDefinition = findFunctionDefinition(
        functionCall.functionName,
        document,
        documentCache,
        functionCall.moduleName || null,
        position.line,
        apiListing
    );

    if (!functionDefinition) {
        return null;
    }

    // Calculate current parameter position
    const activeParameter = calculateActiveParameter(functionCall.parametersText);

    // Create signature information
    const signature: SignatureInformation = {
        label: functionDefinition.signature,
        documentation: functionDefinition.documentation,
        parameters: functionDefinition.parameters
    };

    return {
        signatures: [signature],
        activeSignature: 0,
        activeParameter: Math.min(activeParameter, functionDefinition.parameters.length - 1)
    };
}

/**
 * Find function call in current line.
 *
 */
function findFunctionCall(linePrefix: string): {
    moduleName?: string;
    functionName: string;
    parametersText: string;
} | null {
    const parenIdx = findLastUnmatchedParen(linePrefix);
    if (parenIdx < 0) return null;

    const parametersText = linePrefix.substring(parenIdx + 1);
    const before = linePrefix.substring(0, parenIdx).trimEnd();

    // Module call: Module::Function
    const modMatch = before.match(/(\w+)::(\w+)$/);
    if (modMatch) {
        return {
            moduleName: modMatch[1],
            functionName: modMatch[2],
            parametersText
        };
    }

    // Regular function call
    const fnMatch = before.match(/(\w+)$/);
    if (fnMatch) {
        return {
            functionName: fnMatch[1],
            parametersText
        };
    }

    return null;
}

/**
 * Find the index of the last '(' in s that has no matching ')' to its right
 * (i.e., the innermost currently-open call site), ignoring characters inside
 * PureBasic string literals and balanced inner paren pairs.
 *
 * Scans left-to-right with a stack so that escape strings (~"...\"...") are
 * handled correctly: inside a ~"..." literal, \" does NOT close the string.
 * A reverse scan with simple quote-toggling cannot make this distinction.
 */
function findLastUnmatchedParen(s: string): number {
    let inString = false;
    let isEscape = false;
    const stack: number[] = [];

    for (let i = 0; i < s.length; i++) {
        const ch = s[i];

        if (!inString) {
            if (ch === '"') {
                inString = true;
                isEscape = i > 0 && s[i - 1] === '~';
            } else if (ch === '(') {
                stack.push(i);
            } else if (ch === ')') {
                stack.pop();
            }
        } else {
            if (ch === '"') {
                if (isEscape) {
                    // Count consecutive backslashes before this '"'
                    let bsCount = 0;
                    let k = i - 1;
                    while (k >= 0 && s[k] === '\\') { bsCount++; k--; }
                    // Odd count → escaped quote, stay in string
                    if (bsCount % 2 !== 0) continue;
                }
                inString = false;
                isEscape = false;
            }
        }
    }

    // The last entry on the stack is the innermost unmatched '('
    return stack.length > 0 ? stack[stack.length - 1] : -1;
}

/**
 * Find function definition
 */
function findFunctionDefinition(
    functionName: string,
    document: TextDocument,
    documentCache: Map<string, TextDocument>,
    moduleName: string | null,
    currentLine: number,
    apiListing?: ApiFunctionListing
): {
    signature: string;
    documentation: string;
    parameters: ParameterInformation[];
} | null {
    // Module functions first (if module name is explicitly specified)
    if (moduleName) {
        const funcs = getModuleFunctions(moduleName, document, documentCache);
        const item = funcs.find(f => f.name.toLowerCase() === functionName.toLowerCase());
        if (item) {
            const parameters = parseParameters(item.parameters || '');
            return {
                signature: item.signature,
                documentation: item.documentation,
                parameters
            };
        }
        // If not found inside the module, fall through to user procedure / built-in search below.
    }

    // Find user procedure in current document
    let definition = searchFunctionInDocument(functionName, document);
    if (definition) return definition;

    // Search in other open documents
    for (const [uri, doc] of documentCache) {
        if (uri !== document.uri) {
            definition = searchFunctionInDocument(functionName, doc);
            if (definition) return definition;
        }
    }

    // Search in modules imported by UseModule (when module name is not specified)
    if (!moduleName) {
        const used = getActiveUsedModules(document.getText(), currentLine);
        for (const mod of used) {
            const funcs = getModuleFunctions(mod, document, documentCache);
            const item = funcs.find(f => f.name.toLowerCase() === functionName.toLowerCase());
            if (item) {
                const parameters = parseParameters(item.parameters || '');
                return {
                    signature: item.signature,
                    documentation: item.documentation,
                    parameters
                };
            }
        }
    }

    // Check if this is an OS API function listed in APIFunctionListing.txt
    const apiSig = getApiFunctionSignature(functionName, apiListing);
    if (apiSig) return apiSig;

    // Check if it is a built-in function
    return getBuiltInFunctionSignature(functionName);
}

/**
 * Search for function definition in document
 */
function searchFunctionInDocument(
    functionName: string,
    document: TextDocument
): {
    signature: string;
    documentation: string;
    parameters: ParameterInformation[];
} | null {
    const text = document.getText();
    const lines = text.split('\n');
    const safeFunction = escapeRegExp(functionName);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Match procedure definition (all calling conventions).
        const procMatch = line.match(new RegExp(`^Procedure(?:C|DLL|CDLL)?(?:\\.(\\w+))?\\s+(${safeFunction})\\s*\\(([^)]*)\\)`, 'i'));
        if (procMatch) {
            const returnType = procMatch[1] || '';
            const name = procMatch[2];
            const paramsText = procMatch[3] || '';

            // Reflect the actual calling convention in the signature label
            const kwMatch = line.match(/^(Procedure(?:C|DLL|CDLL)?)/i);
            const kw = kwMatch ? kwMatch[1] : 'Procedure';
            const signature = returnType
                ? `${kw}.${returnType} ${name}(${paramsText})`
                : `${kw} ${name}(${paramsText})`;

            const parameters = parseParameters(paramsText);

            return {
                signature,
                documentation: `User-defined procedure: ${name}`,
                parameters
            };
        }
    }

    return null;
}

/**
 * Split a parameter string on top-level commas only.
 *
 * Commas inside nested parentheses (e.g. default-value expressions like
 * `ArraySize(arr, 0)`) and inside string literals are ignored, so that
 * `Foo(x.i = ArraySize(a, 0), y.s = "a,b")` is correctly split into two
 * parameters instead of four.
 */
function splitTopLevelParams(paramsText: string): string[] {
    const parts: string[] = [''];
    let parenDepth = 0;
    let inString = false;

    for (const char of paramsText) {
        if (char === '"') {
            inString = !inString;
        } else if (!inString) {
            if (char === '(') {
                parenDepth++;
            } else if (char === ')') {
                parenDepth--;
            } else if (char === ',' && parenDepth === 0) {
                parts.push('');
                continue;
            }
        }
        parts[parts.length - 1] += char;
    }

    return parts;
}

/**
 * Parse parameter list
 */
function parseParameters(paramsText: string): ParameterInformation[] {
    if (!paramsText.trim()) {
        return [];
    }

    const parameters: ParameterInformation[] = [];
    const paramList = splitTopLevelParams(paramsText);

    for (const param of paramList) {
        const trimmedParam = param.trim();
        if (trimmedParam) {
            const match = trimmedParam.match(/^((?:Array|List|Map)\s+)?(\*?)(\w+)(?:\.(\w+))?(?:\(\d*\))?/i);
            if (match) {
                const keyword = match[1] ? match[1].trim() + ' ' : '';
                const isPointer = match[2];
                const name = match[3];
                const type = match[4] || 'unknown';
                const label = `${keyword}${isPointer}${name}.${type}`;
                const documentation = keyword
                    ? `Parameter: ${name} (${type}) [${keyword.trim()}]`
                    : `Parameter: ${name} (${type})`;

                parameters.push({
                    label,
                    documentation
                });
            }
        }
    }

    return parameters;
}

/**
 * Build signature help from APIFunctionListing.txt entries.
 */
function getApiFunctionSignature(
    functionName: string,
    apiListing?: ApiFunctionListing
): {
    signature: string;
    documentation: string;
    parameters: ParameterInformation[];
} | null {
    if (!apiListing) return null;

    const entry = apiListing.find(functionName);
    if (!entry) return null;

    const signature = entry.rawParams ? `${entry.pbName}(${entry.rawParams})` : `${entry.pbName}()`;
    const documentation = entry.comment ? `${entry.signature}\n${entry.comment}` : entry.signature;

    const parameters = (entry.params || []).map(p => ({
        label: p,
        documentation: ''
    }));

    return { signature, documentation, parameters };
}

function getBuiltInFunctionSignature(functionName: string): {
    signature: string;
    documentation: string;
    parameters: ParameterInformation[];
} | null {
    const entry = findBuiltin(functionName);
    if (!entry) return null;

    const parameters: ParameterInformation[] = entry.parameters.map(p => ({
        label: p,
        documentation: ''
    }));

    return {
        signature: entry.signature,
        documentation: entry.description,
        parameters
    };
}

/**
 * Calculate index of current active parameter
 */
function calculateActiveParameter(parametersText: string): number {
    if (!parametersText.trim()) {
        return 0;
    }

    // Calculate comma count, but consider parenthesis nesting and strings
    let commaCount = 0;
    let parenDepth = 0;
    let inString = false;

    for (let i = 0; i < parametersText.length; i++) {
        const char = parametersText[i];

        // PureBasic does NOT use backslash as a string escape character.
        // Regular "…" strings treat every '"' as a delimiter.
        // (Escape strings use the ~"…" prefix, but '\' inside "…" has no
        // special meaning.)
        if (char === '"') {
            inString = !inString;
        } else if (!inString) {
            if (char === '(') {
                parenDepth++;
            } else if (char === ')') {
                parenDepth--;
            } else if (char === ',' && parenDepth === 0) {
                commaCount++;
            }
        }
    }

    return commaCount;
}