import { Def, ES2019 } from "../../types/ast"
import { Rule, RuleContext, RuleMeta } from "../../types/rule"
import { Schema } from "../../types/schema"
import * as scope from "../../types/scope"
import { SourceCode } from "../../types/source-code"

export * from "../../types/ast-common"
export * from "../../types/code-path"

// Enhancement AST to not crash on Stage 3 syntaxes.
interface ASTDefinition extends Def.Extends<
    ES2019.ASTDefinition,
    {
        nodes: {}
    }
> {}

export type AST<T extends string = "Node", TFilter = any> =
    Def.ExtractNode<ASTDefinition, T, TFilter>

export type ScopeManager = scope.ScopeManager<AST>
export type Scope = scope.Scope<AST>
export type Variable = scope.Variable<AST>
export type Reference = scope.Reference<AST>
export type VariableDefinition = scope.Definition<AST>

export type RuleContext = RuleContext<AST, any, any>
export type SourceCode = SourceCode<AST>

/**
 * This is to infer the types of
 * - options; this parses JSON Schema then makes the proper type of options.
 * - message IDs.
 * - rule context.
 * - handlers; E.g. the `node` in `{ Identifier(node) {} }` is inferrence as `Identifier` type.
 *
 * @param rule The rule definition.
 */
export declare function rule<TMeta extends RuleMeta>(
    rule: Rule<AST, TMeta>
): Rule<AST, TMeta>
