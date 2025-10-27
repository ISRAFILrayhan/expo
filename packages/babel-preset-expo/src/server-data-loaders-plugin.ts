/**
 * Copyright © 2025 650 Industries.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { ConfigAPI, types as t, NodePath, PluginObj, PluginPass } from '@babel/core';

import { getIsServer } from './common';

const debug = require('debug')('expo:babel:server-data-loaders');

const LOADER_EXPORT_NAME = 'loader';

interface PluginState extends PluginPass {
  /** All discovered identifier references in this file */
  refs: Set<string>;
  /** Whether this file has a loader export */
  isLoader: boolean;
  /** Whether transformation is complete */
  done: boolean;
  /** The current file being processed */
  filename: string;
}

export function serverDataLoadersPlugin(
  api: ConfigAPI & typeof import('@babel/core')
): PluginObj<PluginState> {
  const { types: t } = api;

  const isServer = api.caller(getIsServer);

  const collectReferencesAndNodes = (programPath: NodePath<t.Program>) => {
    const refs = new Set<string>();
    const referenceCounts = new Map<string, { total: number; selfRefs: number }>();

    const functionPaths: NodePath<t.FunctionDeclaration | t.FunctionExpression>[] = [];
    const variablePaths: NodePath<t.VariableDeclarator>[] = [];
    const importPaths: NodePath<t.ImportDeclaration>[] = [];

    programPath.traverse({
      ExportNamedDeclaration(exportPath) {
        const { declaration } = exportPath.node;
        if (!declaration) return;

        if (t.isFunctionDeclaration(declaration) && declaration.id) {
          refs.add(declaration.id.name);
        }

        if (t.isVariableDeclaration(declaration)) {
          declaration.declarations.forEach((declarator: t.VariableDeclarator) => {
            if (t.isIdentifier(declarator.id)) {
              refs.add(declarator.id.name);
            }
          });
        }

        if (t.isClassDeclaration(declaration) && declaration.id) {
          refs.add(declaration.id.name);
        }
      },

      ExportDefaultDeclaration(exportPath) {
        if (
          t.isFunctionDeclaration(exportPath.node.declaration) &&
          exportPath.node.declaration.id
        ) {
          refs.add(exportPath.node.declaration.id.name);
        }
        if (t.isIdentifier(exportPath.node.declaration)) {
          refs.add(exportPath.node.declaration.name);
        }
      },

      FunctionDeclaration(fnPath) {
        functionPaths.push(fnPath);
        if (fnPath.node.id) {
          const fnName = fnPath.node.id.name;
          if (!referenceCounts.has(fnName)) {
            referenceCounts.set(fnName, { total: 0, selfRefs: 0 });
          }
        }
      },

      FunctionExpression(fnPath) {
        functionPaths.push(fnPath);
      },

      VariableDeclarator(varPath) {
        variablePaths.push(varPath);
      },

      ImportDeclaration(importPath) {
        importPaths.push(importPath);
      },

      Identifier(identPath) {
        if (!identPath.isReferencedIdentifier()) return;

        const name = identPath.node.name;
        const binding = identPath.scope.getBinding(name);

        const counts = referenceCounts.get(name) || { total: 0, selfRefs: 0 };
        counts.total++;

        // Check if this is a self-reference (inside the function's own body)
        // Only do this check if we have a binding
        if (binding && binding.path.type === 'FunctionDeclaration') {
          const isSelfRef = identPath.findParent((p) => p === binding.path);
          if (isSelfRef) {
            counts.selfRefs++;
          }
        }

        referenceCounts.set(name, counts);
      },
    });

    // Add identifiers that have external (non-self) references
    for (const [name, counts] of referenceCounts.entries()) {
      if (counts.total > counts.selfRefs) {
        refs.add(name);
      }
    }

    return { refs, functionPaths, variablePaths, importPaths };
  };

  const getIdentifier = (
    path: NodePath<
      | t.FunctionDeclaration
      | t.FunctionExpression
      | t.ArrowFunctionExpression
      | t.VariableDeclarator
    >
  ): string | null => {
    if (path.isVariableDeclarator()) {
      if (path.node.id && t.isIdentifier(path.node.id)) {
        return path.node.id.name;
      }
    }
    if ((path.isFunctionDeclaration() || path.isFunctionExpression()) && path.node.id) {
      return path.node.id.name;
    }
    return null;
  };

  const sweepWithReferenceTracking = (
    programPath: NodePath<t.Program>,
    state: PluginState
  ): void => {
    let shouldContinue = true;
    let iterations = 0;
    const MAX_ITERATIONS = 10;

    while (shouldContinue && iterations < MAX_ITERATIONS) {
      shouldContinue = false;
      iterations++;

      const { refs, functionPaths, variablePaths, importPaths } =
        collectReferencesAndNodes(programPath);

      state.refs = refs;
      debug('Iteration', iterations, '- Reference set size:', state.refs.size);

      // Remove unreferenced functions
      for (const fnPath of functionPaths) {
        const identifier = getIdentifier(fnPath);
        if (identifier && !state.refs.has(identifier)) {
          debug('Removing unreferenced function:', identifier);
          fnPath.remove();
          shouldContinue = true;
        }
      }

      // Remove unreferenced variables
      for (const varPath of variablePaths) {
        const identifier = getIdentifier(varPath);
        if (identifier && !state.refs.has(identifier)) {
          debug('Removing unreferenced variable:', identifier);
          const parent = varPath.parentPath;
          varPath.remove();

          if (parent.isVariableDeclaration() && parent.node.declarations.length === 0) {
            parent.remove();
          }
          shouldContinue = true;
        }
      }

      // Remove unreferenced imports
      for (const importPath of importPaths) {
        const specifiers = importPath.node.specifiers;

        const referencedSpecifiers = specifiers.filter((specifier) => {
          const name = specifier.local.name;
          return state.refs.has(name);
        });

        if (referencedSpecifiers.length === 0) {
          debug('Removing entire import:', importPath.node.source.value);
          importPath.remove();
          shouldContinue = true;
        } else if (referencedSpecifiers.length !== specifiers.length) {
          debug('Removing some import specifiers from:', importPath.node.source.value);
          importPath.node.specifiers = referencedSpecifiers;
          shouldContinue = true;
        }
      }
    }

    if (iterations >= MAX_ITERATIONS) {
      debug('Warning: Maximum sweep iterations reached');
    }
    debug('Sweep completed in', iterations, 'iterations');
  };

  return {
    name: 'expo-server-data-loaders',

    pre(file) {
      // Early exit if file doesn't contain a `loader` named export
      if (!file.code.includes(LOADER_EXPORT_NAME)) {
        debug('Skipping file (no loader export):', file.opts.filename);
        file.path.skip();
        return;
      }
      debug('File may contain loader export:', file.opts.filename);
    },

    visitor: {
      Program: {
        enter(path, state) {
          state.refs = new Set();
          state.isLoader = false;
          state.done = false;
          state.filename = state.file.opts.filename || 'unknown';

          if (isServer) {
            debug('Skipping server bundle:', state.filename);
            state.done = true;
            return;
          }

          debug('Processing client bundle:', state.filename);
        },

        exit(path, state) {
          if (state.done) {
            return;
          }

          if (!state.isLoader) {
            debug('No loader export found, skipping sweep');
            return;
          }

          debug('Loader export found, sweeping with iterative reference tracking');

          sweepWithReferenceTracking(path, state);

          state.done = true;
          debug('Transformation complete for:', state.filename);
        },
      },

      ExportNamedDeclaration(path, state) {
        // Skip if already done or server bundle
        if (state.done || isServer) return;

        const { declaration } = path.node;

        // Handles `export function loader() {}`
        if (t.isFunctionDeclaration(declaration)) {
          const name = declaration.id?.name;
          if (name && isLoaderIdentifier(name)) {
            debug('Found loader function declaration, removing');
            state.isLoader = true;
            path.remove();
          }
        }

        // Handles `export const loader = ...`
        if (t.isVariableDeclaration(declaration)) {
          const originalLength = declaration.declarations.length;
          declaration.declarations = declaration.declarations.filter(
            (declarator: t.VariableDeclarator) => {
              const name = t.isIdentifier(declarator.id) ? declarator.id.name : null;
              if (name && isLoaderIdentifier(name)) {
                debug('Found loader variable declaration, removing');
                state.isLoader = true;
                return false;
              }
              return true;
            }
          );

          // If all declarations were removed, remove the export
          if (declaration.declarations.length === 0) {
            path.remove();
          } else if (declaration.declarations.length < originalLength) {
            debug('Some variable declarations removed from export');
          }
        }
      },
    },
  };
}

/**
 * Checks if identifier name is `loader`
 */
function isLoaderIdentifier(name: string): boolean {
  return name === LOADER_EXPORT_NAME;
}
