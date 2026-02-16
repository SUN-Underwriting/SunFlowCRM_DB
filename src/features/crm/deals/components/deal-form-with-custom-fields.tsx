'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, FormProvider } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { IconCalendar } from '@tabler/icons-react';
import { fieldDefinitionsApi } from '@/lib/api/crm-client';
import type { FieldDefinition } from '@prisma/client';

/**
 * Deal Form Schema with custom fields support
 * Best Practice (Context7): Dynamic validation based on custom field definitions
 */
const baseDealFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  pipelineId: z.string().min(1, 'Pipeline is required'),
  stageId: z.string().min(1, 'Stage is required'),
  value: z.number().min(0).optional(),
  currency: z.string().optional(),
  expectedCloseDate: z.date().optional(),
  personId: z.string().optional(),
  orgId: z.string().optional(),
  customData: z.record(z.string(), z.unknown()).optional()
});

export type DealFormValues = z.infer<typeof baseDealFormSchema>;

interface DealFormWithCustomFieldsProps {
  defaultValues?: Partial<DealFormValues>;
  onSubmit: (values: DealFormValues) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  pipelines?: Array<{ id: string; name: string }>;
  stages?: Array<{ id: string; name: string; pipelineId: string }>;
}

/**
 * Render custom field based on type
 * Best Practice: Type-safe rendering with proper validation
 */
function CustomFieldInput({
  field,
  value,
  onChange
}: {
  field: FieldDefinition;
  value: any;
  onChange: (value: any) => void;
}) {
  switch (field.fieldType) {
    case 'TEXT':
      return (
        <Input
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${field.label.toLowerCase()}`}
        />
      );

    case 'NUMBER':
      return (
        <Input
          type='number'
          value={value || ''}
          onChange={(e) =>
            onChange(
              e.target.value === '' ? undefined : parseFloat(e.target.value)
            )
          }
          placeholder={`Enter ${field.label.toLowerCase()}`}
        />
      );

    case 'DATE':
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant='outline'
              className={cn(
                'w-full justify-start text-left font-normal',
                !value && 'text-muted-foreground'
              )}
            >
              {value ? (
                format(new Date(value), 'PPP')
              ) : (
                <span>Pick a date</span>
              )}
              <IconCalendar className='ml-auto h-4 w-4 opacity-50' />
            </Button>
          </PopoverTrigger>
          <PopoverContent className='w-auto p-0' align='start'>
            <Calendar
              mode='single'
              selected={value ? new Date(value) : undefined}
              onSelect={(date) => onChange(date?.toISOString())}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      );

    case 'SELECT':
      const selectOptions = Array.isArray(field.options)
        ? (field.options as string[])
        : [];
      return (
        <Select value={value || ''} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {selectOptions.map((option) => (
              <SelectItem key={String(option)} value={String(option)}>
                {String(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case 'MULTI_SELECT':
      const multiOptions = Array.isArray(field.options)
        ? (field.options as string[])
        : [];
      const selectedValues = Array.isArray(value) ? value : [];
      return (
        <div className='space-y-2'>
          {multiOptions.map((option) => {
            const optionStr = String(option);
            return (
              <div key={optionStr} className='flex items-center space-x-2'>
                <Checkbox
                  id={`${field.key}-${optionStr}`}
                  checked={selectedValues.includes(optionStr)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onChange([...selectedValues, optionStr]);
                    } else {
                      onChange(
                        selectedValues.filter((v: string) => v !== optionStr)
                      );
                    }
                  }}
                />
                <label
                  htmlFor={`${field.key}-${optionStr}`}
                  className='text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
                >
                  {optionStr}
                </label>
              </div>
            );
          })}
        </div>
      );

    default:
      return null;
  }
}

/**
 * Deal Form with Custom Fields Support
 * Best Practice (Context7): Dynamic form fields based on tenant configuration
 */
export function DealFormWithCustomFields({
  defaultValues,
  onSubmit,
  onCancel,
  isLoading,
  pipelines = [],
  stages = []
}: DealFormWithCustomFieldsProps) {
  // Use React Query for cached custom field definitions
  const { data: customFieldsData, isLoading: loadingFields } = useQuery({
    queryKey: ['field-definitions', 'DEAL'],
    queryFn: async () => {
      const response = await fieldDefinitionsApi.list({ entityType: 'DEAL' });
      return (response.data.fieldDefinitions || []) as FieldDefinition[];
    },
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  const customFields = customFieldsData || [];

  const form = useForm<DealFormValues>({
    resolver: zodResolver(baseDealFormSchema),
    defaultValues: {
      title: '',
      value: 0,
      currency: 'USD',
      customData: {},
      ...defaultValues
    }
  });

  const selectedPipelineId = form.watch('pipelineId');
  const availableStages = stages.filter(
    (stage) => stage.pipelineId === selectedPipelineId
  );

  const handleFormSubmit = async (values: DealFormValues) => {
    await onSubmit(values);
  };

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(handleFormSubmit)}
        className='space-y-6'
      >
        {/* Standard Fields */}
        <FormField
          control={form.control}
          name='title'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title *</FormLabel>
              <FormControl>
                <Input
                  placeholder='e.g., Enterprise Software Deal'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className='grid grid-cols-2 gap-4'>
          <FormField
            control={form.control}
            name='pipelineId'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pipeline *</FormLabel>
                <Select
                  onValueChange={(value) => {
                    field.onChange(value);
                    form.setValue('stageId', '');
                  }}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select pipeline' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {pipelines.map((pipeline) => (
                      <SelectItem key={pipeline.id} value={pipeline.id}>
                        {pipeline.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='stageId'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stage *</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={!selectedPipelineId}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select stage' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableStages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className='grid grid-cols-2 gap-4'>
          <FormField
            control={form.control}
            name='value'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Deal Value</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    placeholder='0'
                    {...field}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === ''
                          ? undefined
                          : parseFloat(e.target.value)
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='currency'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select currency' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value='USD'>USD</SelectItem>
                    <SelectItem value='EUR'>EUR</SelectItem>
                    <SelectItem value='GBP'>GBP</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name='expectedCloseDate'
          render={({ field }) => (
            <FormItem className='flex flex-col'>
              <FormLabel>Expected Close Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant='outline'
                      className={cn(
                        'w-full pl-3 text-left font-normal',
                        !field.value && 'text-muted-foreground'
                      )}
                    >
                      {field.value ? (
                        format(field.value, 'PPP')
                      ) : (
                        <span>Pick a date</span>
                      )}
                      <IconCalendar className='ml-auto h-4 w-4 opacity-50' />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className='w-auto p-0' align='start'>
                  <Calendar
                    mode='single'
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Custom Fields Section */}
        {customFields.length > 0 && (
          <>
            <Separator className='my-6' />
            <div className='space-y-4'>
              <h3 className='text-sm font-semibold'>Custom Fields</h3>
              {customFields.map((customField) => {
                const fieldKey = `customData.${customField.key}`;
                const currentValue =
                  form.watch('customData')?.[customField.key];

                return (
                  <div key={customField.id}>
                    <FormLabel>{customField.label}</FormLabel>
                    <CustomFieldInput
                      field={customField}
                      value={currentValue}
                      onChange={(newValue) => {
                        const currentCustomData =
                          form.getValues('customData') || {};
                        form.setValue('customData', {
                          ...currentCustomData,
                          [customField.key]: newValue
                        });
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </>
        )}

        {loadingFields && (
          <div className='text-muted-foreground text-sm'>
            Loading custom fields...
          </div>
        )}

        <div className='flex justify-end gap-3 pt-4'>
          {onCancel && (
            <Button type='button' variant='outline' onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type='submit' disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Deal'}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
