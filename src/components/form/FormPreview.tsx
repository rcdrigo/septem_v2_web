import { ReactForm } from './ReactForm';

/** Preview uses the same native runtime and validation as task filling. */
export function FormPreview({ schema }: { schema: unknown }) {
  return <ReactForm schema={schema} />;
}
