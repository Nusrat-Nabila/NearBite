import { apiBlob } from "./api";

// Open one private PDF in a new tab. The request is signed with the user's token, so the
// file is fetched here and shown from a temporary address.
export async function openDocument(link) {
  const tab = window.open("", "_blank");

  try {
    const blob = await apiBlob(new URL(link, window.location.origin).pathname);

    if (!blob) throw new Error("missing");

    const address = URL.createObjectURL(blob);

    if (tab) {
      tab.location.href = address;
    } else {
      window.location.href = address;
    }

    setTimeout(() => URL.revokeObjectURL(address), 60000);
  } catch {
    if (tab) tab.close();
    window.alert("This document could not be opened.");
  }
}
