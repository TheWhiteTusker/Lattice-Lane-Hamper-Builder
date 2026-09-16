import { requireUser } from "@/lib/supabase/server";
import { loadSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui";
import { loadPickerData } from "../data";
import { PresentationForm } from "./presentation-form";

export default async function NewPresentationPage() {
  const { supabase } = await requireUser();
  const [picker, settings] = await Promise.all([loadPickerData(supabase), loadSettings(supabase)]);
  const c = settings.company;
  const contact = [c.phone, c.address].filter(Boolean).join("\n");

  return (
    <>
      <PageHeader
        title="New presentation"
        subtitle="Pick hampers and products. Every slide opens in the photo editor afterwards."
      />
      <PresentationForm {...picker} defaultContact={contact} />
    </>
  );
}
