/**
 * Contrato comum dos componentes de painel de propriedades.
 * Cada arquivo em `panels/` exporta um componente que recebe `PanelProps`
 * e compõe seções de `sections/`.
 */
export type PanelProps = {
  modeler: any;
  element: any;
};
