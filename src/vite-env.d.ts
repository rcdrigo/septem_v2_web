/// <reference types="vite/client" />

declare module '*.bpmn?raw' {
  const content: string;
  export default content;
}

declare module '*.bpmn' {
  const content: string;
  export default content;
}

declare module 'bpmn-js/lib/Modeler' {
  const Modeler: any;
  export default Modeler;
}

declare module 'bpmn-js-properties-panel' {
  export const BpmnPropertiesPanelModule: any;
  export const BpmnPropertiesProviderModule: any;
}
