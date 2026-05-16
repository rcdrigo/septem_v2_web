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

declare module '@bpmn-io/form-js' {
  export class FormEditor {
    constructor(opts: { container: HTMLElement | string });
    importSchema(schema: unknown): Promise<{ warnings: unknown[] }>;
    saveSchema(): unknown;
    on(event: string, cb: (...args: unknown[]) => void): void;
    destroy(): void;
  }
}
