const colorMarkers = [
  'septem-bpmn-start',
  'septem-bpmn-intermediate',
  'septem-bpmn-end',
  'septem-bpmn-activity',
  'septem-bpmn-gateway',
] as const;

function markerFor(element: any): (typeof colorMarkers)[number] | undefined {
  if (element.type === 'label' || element.waypoints) return;

  const type: string = element.businessObject?.$type ?? '';
  if (type === 'bpmn:StartEvent') return 'septem-bpmn-start';
  if (type === 'bpmn:EndEvent') return 'septem-bpmn-end';
  if (type === 'bpmn:IntermediateCatchEvent' || type === 'bpmn:IntermediateThrowEvent' || type === 'bpmn:BoundaryEvent') {
    return 'septem-bpmn-intermediate';
  }
  if (type.endsWith('Gateway')) return 'septem-bpmn-gateway';
  if (type.endsWith('Task') || type === 'bpmn:CallActivity' || type === 'bpmn:SubProcess') {
    return 'septem-bpmn-activity';
  }
}

/** Aplica classes de apresentação sem alterar o BPMN ou gerar comandos no editor. */
export function installCanvasColors(modeler: any): () => void {
  const canvas = modeler.get('canvas');
  const elementRegistry = modeler.get('elementRegistry');
  const eventBus = modeler.get('eventBus');

  function syncElement(element: any) {
    if (!element || !elementRegistry.get(element.id)) return;

    const next = markerFor(element);
    for (const marker of colorMarkers) {
      if (canvas.hasMarker(element, marker) && marker !== next) canvas.removeMarker(element, marker);
    }
    if (next && !canvas.hasMarker(element, next)) canvas.addMarker(element, next);
  }

  const syncAll = () => elementRegistry.getAll().forEach(syncElement);
  const syncChanged = ({ elements }: { elements: any[] }) => elements.forEach(syncElement);
  const syncAdded = ({ element }: { element: any }) => syncElement(element);

  eventBus.on('import.done', syncAll);
  eventBus.on('elements.changed', syncChanged);
  eventBus.on('shape.added', syncAdded);

  return () => {
    eventBus.off('import.done', syncAll);
    eventBus.off('elements.changed', syncChanged);
    eventBus.off('shape.added', syncAdded);
  };
}
