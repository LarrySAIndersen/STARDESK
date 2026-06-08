import { notFound } from "next/navigation";

import { Kp2DynamicForm } from "@/components/kundeportal-2/kp2-dynamic-form";
import { getKp2FormSchema } from "@/lib/kundeportal-2/form-schemas";

export default async function Kp2FormPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId } = await params;
  const schema = getKp2FormSchema(formId);
  if (!schema) {
    notFound();
  }
  return <Kp2DynamicForm schema={schema} />;
}
