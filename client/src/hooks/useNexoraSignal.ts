/**
 * useNexoraSignal
 *
 * Universal hook for emitting Nexora signals from any page or component.
 * Every meaningful user action should call emit() so Nexora can reason properly.
 *
 * Usage:
 *   const { emit, emitCTAClick, emitFormStart, emitFormSubmit } = useNexoraSignal();
 */

import { useCallback } from "react";
import { useConcierge } from "@/contexts/ConciergeContext";
import type { NexoraSignalType } from "@/lib/nexoraEngine";

export function useNexoraSignal() {
  const { emit } = useConcierge();

  const emitCTAClick = useCallback(
    (label: string, destination: string) => {
      emit("CTA_CLICK", { label, destination });
    },
    [emit]
  );

  const emitFormStart = useCallback(
    (formType: string) => {
      emit("FORM_START", { formType });
    },
    [emit]
  );

  const emitFormSubmit = useCallback(
    (formType: string, fieldCount: number) => {
      emit("FORM_SUBMIT", { formType, fieldCount });
    },
    [emit]
  );

  const emitFileUpload = useCallback(
    (fileName: string, fileType: string) => {
      emit("FILE_UPLOAD", { fileName, fileType });
    },
    [emit]
  );

  const emitProductView = useCallback(
    (productId: string, productName: string) => {
      emit("PRODUCT_VIEW", { productId, productName });
    },
    [emit]
  );

  const emitPriceView = useCallback(
    (context: string) => {
      emit("PRICE_VIEW", { context });
    },
    [emit]
  );

  const emitAssistantMessage = useCallback(
    (message: string) => {
      emit("ASSISTANT_MESSAGE", { message: message.substring(0, 200) });
    },
    [emit]
  );

  return {
    emit,
    emitCTAClick,
    emitFormStart,
    emitFormSubmit,
    emitFileUpload,
    emitProductView,
    emitPriceView,
    emitAssistantMessage,
  };
}
