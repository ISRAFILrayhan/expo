/**
 * Copyright © 2025 650 Industries.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { ConfigAPI, PluginObj, PluginPass } from '@babel/core';
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
export declare function serverDataLoadersPlugin(api: ConfigAPI & typeof import('@babel/core')): PluginObj<PluginState>;
export {};
