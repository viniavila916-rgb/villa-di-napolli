import { z } from "zod";
import { campaign } from "@/config/campaign";

import { isFullName, isValidWhatsapp, onlyDigits } from "./format";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const bookingSchema = z.object({
  slotId: z.uuid(),
  name: z.string().trim().min(5).max(120).refine(isFullName),
  whatsapp: z.string().refine(isValidWhatsapp).transform(onlyDigits),
  email: z
    .union([z.literal(""), z.email().max(160)])
    .optional()
    .nullable()
    .transform((v) => (v ? v.toLowerCase() : null)),
  incomeRange: z
    .union([z.literal(""), z.enum(campaign.incomeRanges as unknown as [string, ...string[]])])
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  privacyConsent: z.literal(true),
  marketingOptIn: z.boolean().default(false),
  utmSource: optionalText(100),
  utmMedium: optionalText(100),
  utmCampaign: optionalText(100),
  /** Campo-armadilha: pessoas não veem; robôs costumam preencher. */
  website: z.string().max(0).optional().default(""),
  /** Quando o formulário foi aberto (ms). Envio instantâneo = robô. */
  startedAt: z.number().optional(),
});

export type BookingPayload = z.input<typeof bookingSchema>;
