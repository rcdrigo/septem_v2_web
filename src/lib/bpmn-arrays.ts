/**
 * Helpers para extensões `septem:*` que contêm coleções (`isMany: true`).
 *
 * Distintos de `bpmn-helpers.ts`, que cobre extensões escalares
 * (objeto com atributos simples). Aqui o esquema é
 * `septem:Container { isMany items: septem:Item }`.
 */

type AnyModeler = any;
type AnyElement = any;

function ensureExtensionElements(modeler: AnyModeler, element: AnyElement) {
  const moddle = modeler.get('moddle');
  const modeling = modeler.get('modeling');
  const bo = element.businessObject;
  let ext = bo.extensionElements;
  if (!ext) {
    ext = moddle.create('bpmn:ExtensionElements', { values: [] });
    ext.$parent = bo;
    modeling.updateProperties(element, { extensionElements: ext });
  }
  if (!Array.isArray(ext.values)) ext.values = [];
  return ext;
}

export type CollectionSchema = {
  /** Tipo do container, ex. `septem:ActionButtons` */
  containerType: string;
  /** Atributo `isMany` no container, ex. `buttons` */
  itemsProp: string;
  /** Tipo dos itens, ex. `septem:ActionButton` */
  itemType: string;
};

/**
 * Lê a coleção como array plain. Cada item é mapeado por `mapItem` (que recebe
 * o nó moddle bruto e devolve o shape ergonômico esperado pelo componente React).
 */
export function getExtensionCollection<T>(
  element: AnyElement,
  schema: CollectionSchema,
  mapItem: (raw: any) => T,
): T[] {
  const ext = element?.businessObject?.extensionElements;
  if (!ext?.values) return [];
  const container = ext.values.find((v: any) => v.$type === schema.containerType);
  const items = container?.[schema.itemsProp];
  if (!Array.isArray(items)) return [];
  return items.map(mapItem);
}

/**
 * Substitui a coleção inteira. Se `items` está vazio, remove o container do XML
 * pra manter o moddle enxuto.
 */
export function setExtensionCollection<T extends Record<string, any>>(
  modeler: AnyModeler,
  element: AnyElement,
  schema: CollectionSchema,
  items: T[],
) {
  const moddle = modeler.get('moddle');
  const modeling = modeler.get('modeling');
  const ext = ensureExtensionElements(modeler, element);

  let container = ext.values.find((v: any) => v.$type === schema.containerType);

  if (items.length === 0) {
    if (container) ext.values = ext.values.filter((v: any) => v !== container);
  } else {
    if (!container) {
      container = moddle.create(schema.containerType, { [schema.itemsProp]: [] });
      container.$parent = ext;
      ext.values.push(container);
    }
    container[schema.itemsProp] = items.map((it) => {
      const cleaned: Record<string, any> = {};
      for (const [k, v] of Object.entries(it)) {
        if (v === undefined || v === '' || v === null) continue;
        cleaned[k] = v;
      }
      const node = moddle.create(schema.itemType, cleaned);
      node.$parent = container;
      return node;
    });
  }

  modeling.updateProperties(element, { extensionElements: ext });
}
