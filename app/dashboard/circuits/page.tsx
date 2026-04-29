import { redirect } from "next/navigation";

export default function CircuitsPage() {
  redirect("/dashboard?tab=circuits");
}
