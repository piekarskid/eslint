import { Location, Range } from "./ast-common"

/**
 * The Type of AST definition.
 */
export interface ASTDefinition {
    /**
     * A map-like object type to define nodes.
     * 
     * Each key is the node type and its value is the node definition.
     * `Def.NodeRef<T>` in the node definitions will be replaced by the actual node types.
     */
    nodes: object

    /**
     * The union type of statement node types.
     * `Def.NodeRef<"Statement">` will be converted to the nodes of this type.
     */
    statementType: string
    
    /**
     * The union type of statement node types.
     * `Def.NodeRef<"Expression">` will be converted to the nodes of this type.
     */
    expressionType: string
}

/**
 * The difference to enhance AST definition.
 */
export type ASTEnhancement = Partial<ASTDefinition>

/**
 * The type to represent that a node has other nodes.
 */
export interface NodeRef<TType extends string> { $ref: TType }

//------------------------------------------------------------------------------
// Implement `Node<Type, ASTDefinition>`
//------------------------------------------------------------------------------

type Key = keyof any
type IsAny<T> = boolean extends (T extends never ? true : false) ? true : false
type IsNever<T> = false extends (T extends never ? true : false) ? false : true

/**
 * Normalize a given node type.
 * 
 * There are three special types:
 * - `"Node"` ... becomes the union of all node types.
 * - `"Statement"` ... becomes the union of all statement node types.
 * - `"Expression"` ... becomes the union of all expression node types.
 */
type ResolveNodeType<TType extends Key, TDef extends ASTDefinition> =
    & string
    & keyof TDef["nodes"]
    & (
        IsAny<TType> extends true ? keyof TDef["nodes"] :
        TType extends "Node" ? keyof TDef["nodes"] :
        TType extends "Statement" ? TDef["statementType"] :
        TType extends "Expression" ? TDef["expressionType"] :
        /* otherwise */ TType
    )

/**
 * Resolve given node types to the corresponded nodes.
 */
type ResolveNode<TType extends Key, TDef extends ASTDefinition> =
    Node<ResolveNodeType<TType, TDef>, TDef>

/**
 * Resolve given `Def.NodeRef<T>` to the corresponded nodes.
 * If a given type was not `Def.NodeRef<T>`, it's as-is.
 */
type ResolveNodeRef<TMaybeNodeRef, TDef extends ASTDefinition> =
    // If `TMaybeNodeRef` was `any`/`unknown`,
    // `TMaybeNodeRef extends { $ref: Key }` is always true.
    // So we have to take the `$ref` then validate the type of `$ref`.
    TMaybeNodeRef extends { $ref: infer T }
        ? (T extends Key ? ResolveNode<T, TDef> : TMaybeNodeRef)
        : TMaybeNodeRef

/**
 * Resolve given `Def.NodeRef<T>` or `Def.NodeRef<T>[]` to the corresponded nodes.
 * If a given type was not `Def.NodeRef<T>`, it's as-is.
 * 
 * If you modify this logic, modify `NodeRefType` type as same.
 */
type NodeProperty<TValue, TDef extends ASTDefinition> =
    TValue extends (infer TElement)[]
        ? readonly ResolveNodeRef<TElement, TDef>[]
        : ResolveNodeRef<TValue, TDef>

/**
 * The keys of `NodeCommon` interface.
 */
type NodeCommonKey = keyof NodeCommon<any, any>

/**
 * - Add `type` property if not defined.
 * - Resolve all `Def.NodeRef<T>`s in properties.
 */
type NodeBody<
    TDef extends ASTDefinition,
    TType extends keyof TDef["nodes"]
> = {
    readonly [P in Exclude<"type" | keyof TDef["nodes"][TType], NodeCommonKey>]:
        P extends keyof TDef["nodes"][TType]
            ? NodeProperty<TDef["nodes"][TType][P], TDef>
            : TType
}

/**
 * Get the `T` of `NodeRef<T>` or `NodeRef<T>[]`.
 * If you modify this logic, modify `NodeProperty` type as same.
 */
type NodeRefType<TMaybeNodeRef> = Extract<
    | TMaybeNodeRef extends { $ref: infer TType } ? TType : never
    | TMaybeNodeRef extends { $ref: infer TType }[] ? TType : never,
    Key
>

/**
 * Collect all referenced node types (`Def.NodeRef<T>`) in a given node definition.
 */
type ChildNodeType<TNodeDef, TDef extends ASTDefinition> = ResolveNodeType<
    { [P in keyof TNodeDef]: NodeRefType<TNodeDef[P]> }[keyof TNodeDef],
    TDef
>

/**
 * Collect all node types which references to the given node.
 * This is used to calculate `parent` property of each node.
 */
type ParentNodeType<TType extends Key, TDef extends ASTDefinition> = Extract<
    {
        [P in keyof TDef["nodes"]]:
            TType extends ChildNodeType<TDef["nodes"][P], TDef> ? P : never
    }[keyof TDef["nodes"]],
    string
>

/**
 * Convert `never` to `null`. Otherwise, as-is.
 */
type NeverToNull<T> = IsNever<T> extends true ? null : T

/**
 * Calculate `parent` property type.
 */
type ParentNode<TType extends Key, TDef extends ASTDefinition> =
    NeverToNull<Node<ParentNodeType<TType, TDef>, TDef>>

/**
 * - Calculate `parent` property automatically.
 * - Add `range`, `loc`.
 * 
 * This is interface to hide `parent` proeprty in error messages.
 */
interface NodeCommon<TDef extends ASTDefinition, TType extends string> {
    /**
     * The 0-based index of the source code text.
     * The text of this node is `text.slice(node.range[0], node.range[1])`.
     */
    readonly range: Range
    /**
     * The location of this node.
     */
    readonly loc: Location
    /**
     * The parent node.
     */
    readonly parent: ParentNode<TType, TDef>
}

type NodeFallback = {
    [key: string]: undefined
}

/**
 * Define the actual node of the given node type.
 * - `TDefinition["nodes"][TType]` is the node definition.
 * - Resolve all `Def.NodeRef<T>`s in the node definition.
 * - Calculate `parent` property automatically.
 * - Add the common properties (`type`, `range`, `loc`).
 */
export type Node<TType extends string, TDefinition extends ASTDefinition> =
    TType extends keyof TDefinition["nodes"]
        ? (
            & NodeCommon<TDefinition, TType>
            & NodeBody<TDefinition, TType>
            & NodeFallback
        )
        : {} & "UNKNOWN TYPE:" & TType

/**
 * Define the union type of all nodes which have the given type.
 * 
 * There are three special types:
 * - `"Node"` ... becomes the union of all nodes.
 * - `"Statement"` ... becomes the union of all statement nodes.
 * - `"Expression"` ... becomes the union of all expression nodes.
 * 
 * @example
 * // extract computed property.
 * type ComputedProperty =
 *     ExtractNode<ASTDefinition, "Property", { computed: true }>
 */
export type ExtractNode<
    TDefinition extends ASTDefinition,
    TType extends string,
    TFilter = any
> = Extract<
    TType extends "Node" | "Statement" | "Expression"
        ? ResolveNode<TType, TDefinition>
        : Extract<ResolveNode<"Node", TDefinition>, { type: TType }>,
    TFilter
>

//------------------------------------------------------------------------------
// Implement `Extends<ASTDefinition, ASTEnhancement>`
//------------------------------------------------------------------------------

type At0<T extends ASTEnhancement[]> =
    T extends [infer X, ...any[]] ? X : never
type At1<T extends ASTEnhancement[]> =
    T extends [any, infer X, ...any[]] ? X : never
type At2<T extends ASTEnhancement[]> =
    T extends [any, any, infer X, ...any[]] ? X : never
type At3<T extends ASTEnhancement[]> =
    T extends [any, any, any, infer X, ...any[]] ? X : never
type Shift4<T extends ASTEnhancement[]> =
    // We cannot infer the rest element of an array `[any, ...(infer T)]`.
    // Instead, we have to do it with function types.
    ((...x: T) => void) extends
        ((_0: any, _1: any, _2: any, _3: any, ...xs: infer XS) => void)
        ? XS
        : never

type Prop<TObject, TKey extends Key, TExpected = any, TDefault = never> =
    [TObject] extends [{ [P in TKey]: infer TResult }]
        ? (TResult extends TExpected ? TResult : TDefault)
        : TDefault

/**
 * Convert `A[] | B[]` to `(A | B)[]`.
 */
type UniteArray<T> = [T] extends [any[]] ? T[0][] : T

/**
 * Merge the properties of a node definition from a base definition and four enhancements.
 */
type MergeNodeProperties<T, U, V, W, X> = {
    [P in keyof T | keyof U | keyof V | keyof W | keyof X]: UniteArray<
        | (P extends keyof T ? T[P] : never)
        | (P extends keyof U ? U[P] : never)
        | (P extends keyof V ? V[P] : never)
        | (P extends keyof W ? W[P] : never)
        | (P extends keyof X ? X[P] : never)
    >
}

/**
 * Merge every node definition from a base definition and four enhancements.
 */
type MergeNodes<T, U, V, W, X> = {
    [P in keyof T | keyof U | keyof V | keyof W | keyof X]: MergeNodeProperties<
        Prop<T, P, {}, {}>, 
        Prop<U, P, {}, {}>,
        Prop<V, P, {}, {}>,
        Prop<W, P, {}, {}>,
        Prop<X, P, {}, {}>
    >
}

/**
 * Apply enhancements to the base definition.
 * This applies four enhancements at a time because TypeScript's threshold of recursive error is small.
 */
type ExtendsRec<
    TDefinition,
    TEnhancements extends any[]
> = {
    0: TDefinition
    1: ExtendsRec<
        {
            statementType: 
                | Prop<TDefinition, "statementType", string>
                | Prop<At0<TEnhancements>, "statementType", string>
                | Prop<At1<TEnhancements>, "statementType", string>
                | Prop<At2<TEnhancements>, "statementType", string>
                | Prop<At3<TEnhancements>, "statementType", string>
            expressionType:
                | Prop<TDefinition, "expressionType", string>
                | Prop<At0<TEnhancements>, "expressionType", string>
                | Prop<At1<TEnhancements>, "expressionType", string>
                | Prop<At2<TEnhancements>, "expressionType", string>
                | Prop<At3<TEnhancements>, "expressionType", string>
            nodes: MergeNodes<
                Prop<TDefinition, "nodes", {}, {}>,
                Prop<At0<TEnhancements>, "nodes", {}, {}>,
                Prop<At1<TEnhancements>, "nodes", {}, {}>,
                Prop<At2<TEnhancements>, "nodes", {}, {}>,
                Prop<At3<TEnhancements>, "nodes", {}, {}>
            >
        },
        Shift4<TEnhancements>
    >
}[TEnhancements extends [] ? 0 : 1]

/**
 * Apply one or more enhancements to the base definition.
 */
export type Extends<
    TDefinition extends ASTDefinition,
    TEnhancement extends ASTEnhancement | ASTEnhancement[]
> = ExtendsRec<
    TDefinition,
    TEnhancement extends ASTEnhancement[] ? TEnhancement : [TEnhancement]
>
