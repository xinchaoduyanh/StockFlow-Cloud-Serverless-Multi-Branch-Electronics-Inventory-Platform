import { createVerify } from "node:crypto";

type SnsEnvelope = {
  Type?: string;
  Message?: string;
  MessageId?: string;
  Subject?: string;
  SubscribeURL?: string;
  Timestamp?: string;
  TopicArn?: string;
  Signature?: string;
  SignatureVersion?: string;
  SigningCertURL?: string;
};

export function isAllowedSnsUrl(value: string, region: string, pathPrefix: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === `sns.${region}.amazonaws.com` &&
      url.pathname.startsWith(pathPrefix)
    );
  } catch {
    return false;
  }
}

export function isAllowedSnsSubscriptionUrl(value: string, region: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === `sns.${region}.amazonaws.com` &&
      url.searchParams.get("Action") === "ConfirmSubscription"
    );
  } catch {
    return false;
  }
}

export function snsStringToSign(message: SnsEnvelope) {
  const fields =
    message.Type === "SubscriptionConfirmation"
      ? ["Message", "MessageId", "SubscribeURL", "Timestamp", "TopicArn", "Type"]
      : [
          "Message",
          ...(message.Subject ? ["Subject"] : []),
          "MessageId",
          "Timestamp",
          "TopicArn",
          "Type",
        ];
  return fields
    .map((field) => `${field}\n${String(message[field as keyof SnsEnvelope] ?? "")}\n`)
    .join("");
}

export async function verifySnsEnvelope(message: SnsEnvelope, region: string) {
  if (
    !message.Signature ||
    !message.SigningCertURL ||
    !["1", "2"].includes(message.SignatureVersion ?? "")
  )
    return false;
  if (!isAllowedSnsUrl(message.SigningCertURL, region, "/SimpleNotificationService-")) return false;
  const certificate = await fetch(message.SigningCertURL, {
    signal: AbortSignal.timeout(5000),
  });
  if (!certificate.ok) return false;
  const verifier = createVerify(message.SignatureVersion === "2" ? "sha256" : "sha1");
  verifier.update(snsStringToSign(message), "utf8");
  verifier.end();
  return verifier.verify(await certificate.text(), message.Signature, "base64");
}
