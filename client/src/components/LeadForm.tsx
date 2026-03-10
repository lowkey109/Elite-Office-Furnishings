import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowRight, Loader2 } from "lucide-react";

type FormField = {
  name: string;
  label: string;
  type: "text" | "email" | "tel" | "textarea" | "select";
  placeholder?: string;
  options?: string[];
  required?: boolean;
  half?: boolean;
};

interface LeadFormProps {
  formType: string;
  fields: FormField[];
  onSuccess: () => void;
  submitLabel?: string;
}

export function LeadForm({ formType, fields, onSuccess, submitLabel = "Submit" }: LeadFormProps) {
  const { toast } = useToast();

  const schema = z.object(
    fields.reduce((acc, field) => {
      if (field.required !== false) {
        acc[field.name] = z.string().min(1, `${field.label} is required`);
      } else {
        acc[field.name] = z.string().optional();
      }
      return acc;
    }, {} as Record<string, z.ZodTypeAny>)
  );

  type FormData = z.infer<typeof schema>;

  const defaultValues = fields.reduce((acc, field) => {
    acc[field.name] = "";
    return acc;
  }, {} as Record<string, string>);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      apiRequest("POST", "/api/leads", { ...data, type: formType }),
    onSuccess: () => {
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Something went wrong",
        description: "Please try again or call us on 1300 977 607.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  const inputClass = "bg-[rgba(255,255,255,0.05)] border-[rgba(201,168,76,0.2)] text-white placeholder:text-white/30 focus:border-[rgba(201,168,76,0.5)] focus:ring-0 h-12 text-base rounded-md";

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        {fields.map((field) => (
          <div
            key={field.name}
            className={
              field.half === false || field.type === "textarea"
                ? "sm:col-span-2"
                : ""
            }
          >
            <Label
              htmlFor={field.name}
              className="text-white/70 text-sm font-medium mb-2 block"
            >
              {field.label}
              {field.required !== false && (
                <span className="text-[hsl(43,78%,52%)] ml-1">*</span>
              )}
            </Label>

            {field.type === "textarea" ? (
              <Textarea
                id={field.name}
                placeholder={field.placeholder}
                className="bg-[rgba(255,255,255,0.05)] border-[rgba(201,168,76,0.2)] text-white placeholder:text-white/30 focus:border-[rgba(201,168,76,0.5)] focus:ring-0 min-h-[120px] text-base rounded-md resize-none"
                data-testid={`input-${field.name}`}
                style={{ fontSize: "16px", touchAction: "manipulation" }}
                {...form.register(field.name)}
              />
            ) : field.type === "select" ? (
              <Select onValueChange={(val) => form.setValue(field.name, val)}>
                <SelectTrigger
                  className="bg-[rgba(255,255,255,0.05)] border-[rgba(201,168,76,0.2)] text-white/60 focus:border-[rgba(201,168,76,0.5)] h-12 text-base rounded-md"
                  data-testid={`select-${field.name}`}
                  style={{ touchAction: "manipulation" }}
                >
                  <SelectValue
                    placeholder={field.placeholder || `Select ${field.label}`}
                  />
                </SelectTrigger>
                <SelectContent className="bg-[hsl(220,18%,12%)] border-[rgba(201,168,76,0.2)]">
                  {field.options?.map((opt) => (
                    <SelectItem
                      key={opt}
                      value={opt}
                      className="text-white/80 focus:text-white focus:bg-[rgba(201,168,76,0.1)] min-h-[44px] text-base"
                    >
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={field.name}
                type={field.type}
                placeholder={field.placeholder}
                className={inputClass}
                data-testid={`input-${field.name}`}
                autoComplete={
                  field.type === "email"
                    ? "email"
                    : field.type === "tel"
                    ? "tel"
                    : field.name === "name"
                    ? "name"
                    : field.name === "company"
                    ? "organization"
                    : "off"
                }
                style={{ fontSize: "16px", touchAction: "manipulation" }}
                {...form.register(field.name)}
              />
            )}

            {form.formState.errors[field.name] && (
              <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                <span>⚠</span>
                {String(form.formState.errors[field.name]?.message || "")}
              </p>
            )}
          </div>
        ))}
      </div>

      <Button
        type="submit"
        disabled={mutation.isPending}
        className="w-full bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold border-none text-base min-h-[56px]"
        data-testid="button-submit-form"
        style={{ touchAction: "manipulation" }}
      >
        {mutation.isPending ? (
          <>
            <Loader2 className="mr-2 w-5 h-5 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            {submitLabel}
            <ArrowRight className="ml-2 w-5 h-5" />
          </>
        )}
      </Button>

      <p className="text-center text-xs text-white/35 leading-relaxed">
        We respect your privacy. Your details will only be used to respond to your enquiry.
      </p>
    </form>
  );
}
