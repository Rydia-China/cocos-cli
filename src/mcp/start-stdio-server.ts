import { CocosAPI } from '../api';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { toolRegistry } from '../api/decorator/decorator';
import { z } from 'zod';
import * as pkgJson from '../../package.json';
import { ResourceManager } from './resources';
import { BuilderHook } from './hooks/builder.hook';
import { join } from 'path';
import stripAnsi from 'strip-ansi';
import { HTTP_STATUS } from '../api/base/schema-base';

/**
 * Start MCP server in stdio mode for Claude Code integration
 */
export async function startStdioServer(folder: string) {
    // Initialize Cocos API
    const cocosAPI = await CocosAPI.create();
    await cocosAPI.startup(folder);

    // Create MCP server
    const server = new McpServer({
        name: 'cocos-cli',
        version: pkgJson.version || '0.0.0',
    }, {
        capabilities: {
            resources: {
                subscribe: true,
                listChanged: true,
                templates: true
            },
            tools: {},
            logging: {},
        }
    });

    const builderHook = new BuilderHook();
    const docsPath = join(__dirname, '../../docs');
    const resourceManager = new ResourceManager(docsPath);

    // Helper function to get tool instance
    const instanceCache = new Map<any, any>();
    const getToolInstance = async (target: any): Promise<any> => {
        if (instanceCache.has(target)) {
            return instanceCache.get(target);
        }
        const instance = new target();
        instanceCache.set(target, instance);
        return instance;
    };

    // Helper function to prepare method arguments
    const prepareMethodArguments = (meta: any, args: any): any[] => {
        if (!meta.paramSchemas || meta.paramSchemas.length === 0) {
            return [];
        }

        const methodArgs: any[] = [];
        const sortedParams = meta.paramSchemas.sort((a: any, b: any) => a.index - b.index);

        for (const param of sortedParams) {
            const paramName = param.name || `param${param.index}`;
            const value = args[paramName];
            methodArgs.push(value);
        }

        return methodArgs;
    };

    // Helper function to call tool method
    const callToolMethod = async (target: any, meta: any, args: any[]): Promise<any> => {
        const instance = await getToolInstance(target);
        const method = instance[meta.methodName];
        if (typeof method !== 'function') {
            throw new Error(`Method ${String(meta.methodName)} not found on instance`);
        }
        return await method.apply(instance, args);
    };

    // Helper function to format tool result
    const formatToolResult = (meta: any, result: any): string => {
        let resultText = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
        return stripAnsi(resultText);
    };

    // Register tools from decorator registry
    Array.from(toolRegistry.entries()).forEach(([toolName, { target, meta }]) => {
        try {
            const inputSchemaFields: Record<string, z.ZodTypeAny> = {};
            meta.paramSchemas
                .sort((a, b) => a.index - b.index)
                .forEach(param => {
                    if (param.name) {
                        builderHook.onRegisterParam(toolName, param, inputSchemaFields);
                        if (!inputSchemaFields[param.name]) {
                            inputSchemaFields[param.name] = param.schema;
                        }
                    }
                });

            server.tool(
                toolName,
                meta.description || `Tool: ${toolName}`,
                inputSchemaFields,
                async (args) => {
                    try {
                        builderHook.onBeforeExecute(toolName, args);
                        const methodArgs = prepareMethodArguments(meta, args);
                        const result = await callToolMethod(target, meta, methodArgs);
                        const formattedResult = formatToolResult(meta, result);

                        let structuredContent: any;
                        if (meta.returnSchema) {
                            try {
                                const validatedResult = meta.returnSchema.parse(result);
                                structuredContent = { result: validatedResult };
                            } catch {
                                structuredContent = { result: result };
                            }
                        } else {
                            structuredContent = { result: result };
                        }

                        return {
                            content: [{ type: 'text', text: formattedResult }],
                            structuredContent: structuredContent,
                            isError: result.code === 500
                        };
                    } catch (error: any) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        const errorStack = error instanceof Error ? error.stack : undefined;

                        let detailedReason = `Tool execution failed (${toolName}): ${errorMessage}`;
                        if (errorStack && process.env.NODE_ENV === 'development') {
                            detailedReason += `\n\nStack trace:\n${errorStack}`;
                        }
                        detailedReason += `\n\nParameters passed:\n${JSON.stringify(args, null, 2)}`;

                        console.error(`[MCP] ${detailedReason}`);

                        const errorResult = {
                            code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
                            data: undefined,
                            reason: detailedReason,
                        };

                        const formattedResult = JSON.stringify({ result: errorResult }, null, 2);
                        return {
                            content: [{ type: 'text', text: formattedResult }],
                            structuredContent: { result: errorResult },
                            isError: true
                        };
                    }
                }
            );
        } catch (error) {
            console.error(`Failed to register tool ${toolName}:`, error);
        }
    });

    // Register resources
    const resources = resourceManager.loadAllResources();
    resources.forEach(resource => {
        server.resource(
            resource.name,
            resource.uri,
            { name: resource.name, description: resource.description || resource.title },
            async () => {
                return {
                    contents: [{
                        uri: resource.uri,
                        mimeType: resource.mimeType || 'text/plain',
                        text: resource.content || '',
                    }],
                };
            }
        );
    });

    // Start stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error('[MCP] Stdio server started successfully');
}
