'use client';

/**
 * MaskInput component adapted from DiceUI.
 * @see https://www.diceui.com/docs/components/radix/mask-input
 *
 * Supports currency and percentage masks for deal/lead forms.
 * Uses Intl.NumberFormat for locale-aware currency formatting.
 */

import { Slot as SlotPrimitive } from '@radix-ui/react-slot';
import * as React from 'react';
import { useComposedRefs } from '@/lib/compose-refs';
import { cn } from '@/lib/utils';

const DEFAULT_CURRENCY = 'USD';
const DEFAULT_LOCALE = 'en-US';

const CURRENCY_PERCENTAGE_SYMBOLS = /[€$%]/;

interface CurrencySymbols {
  currency: string;
  decimal: string;
  group: string;
}

const formattersCache = new Map<string, Intl.NumberFormat>();
const currencySymbolsCache = new Map<string, CurrencySymbols>();
const currencyAtEndCache = new Map<string, boolean>();

const REGEX_CACHE = {
  nonDigits: /\D/g,
  nonCurrencyChars: /[^\d.,]/g,
  hashPattern: /#/g,
  currencyAtEnd: /\d\s*[^\d\s]+$/,
  percentageChars: /[^\d.]/g,
  currencyValidation: /^\d+(\.\d{1,2})?$/
} as const;

function getCachedFormatter(
  locale: string | undefined,
  opts: Intl.NumberFormatOptions
): Intl.NumberFormat {
  const {
    currency,
    minimumFractionDigits = 0,
    maximumFractionDigits = 2
  } = opts;
  const key = `${locale}|${currency}|${minimumFractionDigits}|${maximumFractionDigits}`;
  if (!formattersCache.has(key)) {
    try {
      formattersCache.set(
        key,
        new Intl.NumberFormat(locale, { style: 'currency', currency, ...opts })
      );
    } catch {
      formattersCache.set(
        key,
        new Intl.NumberFormat(DEFAULT_LOCALE, {
          style: 'currency',
          currency: DEFAULT_CURRENCY,
          ...opts
        })
      );
    }
  }
  return formattersCache.get(key)!;
}

function getCachedCurrencySymbols(opts: TransformOptions): CurrencySymbols {
  const { locale, currency } = opts;
  const key = `${locale}|${currency}`;
  const cached = currencySymbolsCache.get(key);
  if (cached) return cached;

  let currencySymbol = '$';
  let decimalSeparator = '.';
  let groupSeparator = ',';

  try {
    const formatter = getCachedFormatter(locale, {
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
    const parts = formatter.formatToParts(1234.5);
    const cp = parts.find((p) => p.type === 'currency');
    const dp = parts.find((p) => p.type === 'decimal');
    const gp = parts.find((p) => p.type === 'group');
    if (cp) currencySymbol = cp.value;
    if (dp) decimalSeparator = dp.value;
    if (gp) groupSeparator = gp.value;
  } catch {
    /* keep defaults */
  }

  const symbols: CurrencySymbols = {
    currency: currencySymbol,
    decimal: decimalSeparator,
    group: groupSeparator
  };
  currencySymbolsCache.set(key, symbols);
  return symbols;
}

function isCurrencyAtEnd(opts: TransformOptions): boolean {
  const { locale, currency } = opts;
  const key = `${locale}|${currency}`;
  const cached = currencyAtEndCache.get(key);
  if (cached !== undefined) return cached;
  try {
    const formatter = getCachedFormatter(locale, {
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
    const sample = formatter.format(123);
    const result = REGEX_CACHE.currencyAtEnd.test(sample);
    currencyAtEndCache.set(key, result);
    return result;
  } catch {
    currencyAtEndCache.set(key, false);
    return false;
  }
}

interface TransformOptions {
  currency?: string;
  locale?: string;
}

interface ValidateOptions {
  min?: number;
  max?: number;
}

interface MaskPattern {
  pattern: string;
  transform?: (value: string, opts?: TransformOptions) => string;
  validate?: (value: string, opts?: ValidateOptions) => boolean;
}

type MaskPatternKey = 'currency' | 'percentage';

const MASK_PATTERNS: Record<MaskPatternKey, MaskPattern> = {
  currency: {
    pattern: '$###,###.##',
    transform: (
      value,
      { currency = DEFAULT_CURRENCY, locale = DEFAULT_LOCALE } = {}
    ) => {
      let localeDecimalSeparator = '.';
      try {
        const formatter = getCachedFormatter(locale, {
          currency,
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        });
        const parts = formatter.formatToParts(1234.5);
        const dp = parts.find((p) => p.type === 'decimal');
        if (dp) localeDecimalSeparator = dp.value;
      } catch {
        /* keep default */
      }

      const cleaned = value.replace(REGEX_CACHE.nonCurrencyChars, '');
      const dotIndex = cleaned.indexOf('.');
      const commaIndex = cleaned.indexOf(',');
      let hasDecimalSeparator = false;
      let decimalIndex = -1;

      if (localeDecimalSeparator === ',') {
        const lastCommaIndex = cleaned.lastIndexOf(',');
        if (lastCommaIndex !== -1) {
          const after = cleaned.substring(lastCommaIndex + 1);
          if (after.length <= 2 && /^\d*$/.test(after)) {
            hasDecimalSeparator = true;
            decimalIndex = lastCommaIndex;
          }
        }
        if (!hasDecimalSeparator && dotIndex !== -1) {
          const after = cleaned.substring(dotIndex + 1);
          if (after.length <= 2 && /^\d*$/.test(after)) {
            hasDecimalSeparator = true;
            decimalIndex = dotIndex;
          }
        }
      } else {
        const lastDotIndex = cleaned.lastIndexOf('.');
        if (lastDotIndex !== -1) {
          const after = cleaned.substring(lastDotIndex + 1);
          if (after.length <= 2 && /^\d*$/.test(after)) {
            hasDecimalSeparator = true;
            decimalIndex = lastDotIndex;
          }
        }
        if (!hasDecimalSeparator && commaIndex !== -1) {
          const after = cleaned.substring(commaIndex + 1);
          const looksLikeThousands =
            commaIndex <= 3 && after.length >= 3;
          if (
            !looksLikeThousands &&
            after.length <= 2 &&
            /^\d*$/.test(after)
          ) {
            hasDecimalSeparator = true;
            decimalIndex = commaIndex;
          }
        }
      }

      if (hasDecimalSeparator && decimalIndex !== -1) {
        const before = cleaned
          .substring(0, decimalIndex)
          .replace(/[.,]/g, '');
        const after = cleaned
          .substring(decimalIndex + 1)
          .replace(/[.,]/g, '');
        if (after === '') return `${before}.`;
        return `${before}.${after.substring(0, 2)}`;
      }
      return cleaned.replace(/[.,]/g, '');
    },
    validate: (value) => {
      if (!REGEX_CACHE.currencyValidation.test(value)) return false;
      const num = parseFloat(value);
      return !Number.isNaN(num) && num >= 0;
    }
  },
  percentage: {
    pattern: '##.##%',
    transform: (value) => {
      const cleaned = value.replace(REGEX_CACHE.percentageChars, '');
      const parts = cleaned.split('.');
      if (parts.length > 2)
        return `${parts[0]}.${parts.slice(1).join('')}`;
      if (parts[1] && parts[1].length > 2)
        return `${parts[0]}.${parts[1].substring(0, 2)}`;
      return cleaned;
    },
    validate: (value, opts = {}) => {
      const num = parseFloat(value);
      const min = opts.min ?? 0;
      const max = opts.max ?? 100;
      return !Number.isNaN(num) && num >= min && num <= max;
    }
  }
};

function applyCurrencyMask(opts: {
  value: string;
  currency?: string;
  locale?: string;
}): string {
  const { value, currency = DEFAULT_CURRENCY, locale = DEFAULT_LOCALE } = opts;
  if (!value) return '';
  const {
    currency: currencySymbol,
    decimal: decimalSeparator,
    group: groupSeparator
  } = getCachedCurrencySymbols({ locale, currency });
  const normalizedValue = value
    .replace(
      new RegExp(
        `\\${groupSeparator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
        'g'
      ),
      ''
    )
    .replace(decimalSeparator, '.');
  const parts = normalizedValue.split('.');
  const integerPart = parts[0] ?? '';
  const fractionalPart = parts[1] ?? '';
  if (!integerPart && !fractionalPart) return '';
  const intValue = integerPart ?? '0';
  const fracValue = fractionalPart.slice(0, 2);
  const num = Number(`${intValue}.${fracValue ?? ''}`);
  if (Number.isNaN(num)) {
    const cleanedDigits = value.replace(/[^\d]/g, '');
    if (!cleanedDigits) return '';
    return `${currencySymbol}${cleanedDigits}`;
  }
  const hasExplicitDecimal =
    value.includes('.') || value.includes(decimalSeparator);
  try {
    const formatter = getCachedFormatter(locale, {
      currency,
      minimumFractionDigits: fracValue ? fracValue.length : 0,
      maximumFractionDigits: 2
    });
    const result = formatter.format(num);
    if (hasExplicitDecimal && !fracValue) {
      if (result.match(/^[^\d\s]+/))
        return result.replace(/(\d)$/, `$1${decimalSeparator}`);
      return result.replace(
        /(\d)(\s*)([^\d\s]+)$/,
        `$1${decimalSeparator}$2$3`
      );
    }
    return result;
  } catch {
    const formattedInt = intValue.replace(
      /\B(?=(\d{3})+(?!\d))/g,
      groupSeparator
    );
    let result = `${currencySymbol}${formattedInt}`;
    if (hasExplicitDecimal) result += `${decimalSeparator}${fracValue}`;
    return result;
  }
}

function applyPercentageMask(value: string): string {
  if (!value) return '';
  const parts = value.split('.');
  let result = parts[0] ?? '0';
  if (value.includes('.')) result += `.${(parts[1] ?? '').substring(0, 2)}`;
  return `${result}%`;
}

function applyMask(opts: {
  value: string;
  pattern: string;
  currency?: string;
  locale?: string;
  mask?: MaskPatternKey | MaskPattern;
}): string {
  const { value, pattern, currency, locale, mask } = opts;
  if (
    pattern.includes('$') ||
    pattern.includes('€') ||
    mask === 'currency'
  ) {
    return applyCurrencyMask({
      value,
      currency: currency ?? DEFAULT_CURRENCY,
      locale: locale ?? DEFAULT_LOCALE
    });
  }
  if (pattern.includes('%')) return applyPercentageMask(value);
  const maskedChars: string[] = [];
  let valueIndex = 0;
  for (let i = 0; i < pattern.length && valueIndex < value.length; i++) {
    const pc = pattern[i];
    const vc = value[valueIndex];
    if (pc === '#' && vc) {
      maskedChars.push(vc);
      valueIndex++;
    } else if (pc) {
      maskedChars.push(pc);
    }
  }
  return maskedChars.join('');
}

function getUnmaskedValue(opts: {
  value: string;
  currency?: string;
  locale?: string;
  transform?: (value: string, opts?: TransformOptions) => string;
}): string {
  const { value, transform, currency, locale } = opts;
  return transform
    ? transform(value, { currency, locale })
    : value.replace(REGEX_CACHE.nonDigits, '');
}

type InputElement = React.ComponentRef<'input'>;

interface MaskInputProps extends React.ComponentProps<'input'> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (maskedValue: string, unmaskedValue: string) => void;
  onValidate?: (isValid: boolean, unmaskedValue: string) => void;
  validationMode?: 'onChange' | 'onBlur' | 'onSubmit' | 'onTouched' | 'all';
  mask?: MaskPatternKey | MaskPattern;
  maskPlaceholder?: string;
  currency?: string;
  locale?: string;
  asChild?: boolean;
  invalid?: boolean;
  withoutMask?: boolean;
}

function MaskInput(props: MaskInputProps) {
  const {
    value: valueProp,
    defaultValue,
    onValueChange: onValueChangeProp,
    onValidate,
    onBlur: onBlurProp,
    onFocus: onFocusProp,
    validationMode = 'onChange',
    mask,
    maskPlaceholder,
    currency = DEFAULT_CURRENCY,
    locale = DEFAULT_LOCALE,
    placeholder,
    inputMode,
    min,
    max,
    maxLength,
    asChild = false,
    disabled = false,
    invalid = false,
    readOnly = false,
    required = false,
    withoutMask = false,
    className,
    ref,
    ...inputProps
  } = props;

  const [internalValue, setInternalValue] = React.useState(defaultValue ?? '');
  const [focused, setFocused] = React.useState(false);
  const [touched, setTouched] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const composedRef = useComposedRefs(ref, inputRef);

  const isControlled = valueProp !== undefined;
  const value = isControlled ? valueProp : internalValue;

  const maskPattern = React.useMemo(() => {
    if (typeof mask === 'string') return MASK_PATTERNS[mask];
    return mask;
  }, [mask]);

  const transformOpts = React.useMemo(
    () => ({ currency, locale }),
    [currency, locale]
  );

  const placeholderValue = React.useMemo(() => {
    if (withoutMask) return placeholder;
    if (placeholder && maskPlaceholder)
      return focused ? maskPlaceholder : placeholder;
    if (maskPlaceholder) return focused ? maskPlaceholder : undefined;
    return placeholder;
  }, [placeholder, maskPlaceholder, focused, withoutMask]);

  const displayValue = React.useMemo(() => {
    if (withoutMask || !maskPattern || !value) return value ?? '';
    const unmasked = getUnmaskedValue({
      value,
      transform: maskPattern.transform,
      ...transformOpts
    });
    return applyMask({
      value: unmasked,
      pattern: maskPattern.pattern,
      ...transformOpts,
      mask
    });
  }, [value, maskPattern, withoutMask, transformOpts, mask]);

  const calculatedInputMode = React.useMemo(() => {
    if (inputMode) return inputMode;
    if (!maskPattern) return undefined;
    if (mask === 'currency' || mask === 'percentage') return 'decimal';
    return undefined;
  }, [maskPattern, mask, inputMode]);

  const shouldValidate = React.useCallback(
    (trigger: 'change' | 'blur') => {
      if (!onValidate || !maskPattern?.validate) return false;
      switch (validationMode) {
        case 'onChange':
          return trigger === 'change';
        case 'onBlur':
          return trigger === 'blur';
        case 'onSubmit':
          return false;
        case 'onTouched':
          return touched ? trigger === 'change' : trigger === 'blur';
        case 'all':
          return true;
        default:
          return trigger === 'change';
      }
    },
    [onValidate, maskPattern, validationMode, touched]
  );

  const validationOpts = React.useMemo(
    () => ({
      min: typeof min === 'string' ? parseFloat(min) : min,
      max: typeof max === 'string' ? parseFloat(max) : max
    }),
    [min, max]
  );

  const onInputValidate = React.useCallback(
    (unmaskedValue: string) => {
      if (onValidate && maskPattern?.validate) {
        const isValid = maskPattern.validate(unmaskedValue, validationOpts);
        onValidate(isValid, unmaskedValue);
      }
    },
    [onValidate, maskPattern?.validate, validationOpts]
  );

  const onValueChange = React.useCallback(
    (event: React.ChangeEvent<InputElement>) => {
      const inputValue = event.target.value;
      let newValue = inputValue;
      let unmaskedValue = inputValue;

      if (withoutMask || !maskPattern) {
        if (!isControlled) setInternalValue(inputValue);
        if (shouldValidate('change')) onValidate?.(true, inputValue);
        onValueChangeProp?.(inputValue, inputValue);
        return;
      }

      unmaskedValue = getUnmaskedValue({
        value: inputValue,
        transform: maskPattern.transform,
        ...transformOpts
      });
      newValue = applyMask({
        value: unmaskedValue,
        pattern: maskPattern.pattern,
        ...transformOpts,
        mask
      });

      if (inputRef.current && newValue !== inputValue) {
        const el = inputRef.current;
        if (el instanceof HTMLInputElement) {
          el.value = newValue;

          if (mask === 'currency') {
            const currencyEnd = isCurrencyAtEnd(transformOpts);
            if (currencyEnd) {
              const match = newValue.match(/(\d)\s*([^\d\s]+)$/);
              if (match?.[1]) {
                const pos = newValue.lastIndexOf(match[1]) + 1;
                el.setSelectionRange(pos, pos);
              }
            } else {
              el.setSelectionRange(newValue.length, newValue.length);
            }
          } else if (maskPattern.pattern.includes('%')) {
            const pos = Math.max(0, newValue.length - 1);
            el.setSelectionRange(pos, pos);
          } else {
            el.setSelectionRange(newValue.length, newValue.length);
          }
        }
      }

      if (!isControlled) setInternalValue(newValue);
      if (shouldValidate('change')) onInputValidate(unmaskedValue);
      onValueChangeProp?.(newValue, unmaskedValue);
    },
    [
      maskPattern,
      isControlled,
      onValueChangeProp,
      onValidate,
      onInputValidate,
      shouldValidate,
      withoutMask,
      transformOpts,
      mask
    ]
  );

  const onFocus = React.useCallback(
    (event: React.FocusEvent<InputElement>) => {
      onFocusProp?.(event);
      if (event.defaultPrevented) return;
      setFocused(true);
    },
    [onFocusProp]
  );

  const onBlur = React.useCallback(
    (event: React.FocusEvent<InputElement>) => {
      onBlurProp?.(event);
      if (event.defaultPrevented) return;
      setFocused(false);
      if (!touched) setTouched(true);
      if (shouldValidate('blur')) {
        const currentValue = event.target.value;
        const unmaskedValue = maskPattern
          ? getUnmaskedValue({
              value: currentValue,
              transform: maskPattern.transform,
              ...transformOpts
            })
          : currentValue;
        onInputValidate(unmaskedValue);
      }
    },
    [
      onBlurProp,
      touched,
      shouldValidate,
      onInputValidate,
      maskPattern,
      transformOpts
    ]
  );

  const InputPrimitive = asChild ? SlotPrimitive : 'input';

  return (
    <InputPrimitive
      aria-invalid={invalid}
      data-disabled={disabled ? '' : undefined}
      data-invalid={invalid ? '' : undefined}
      data-readonly={readOnly ? '' : undefined}
      data-required={required ? '' : undefined}
      data-slot='mask-input'
      {...inputProps}
      className={cn(
        'flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
        className
      )}
      placeholder={placeholderValue}
      ref={composedRef}
      value={displayValue}
      disabled={disabled}
      maxLength={maxLength}
      readOnly={readOnly}
      required={required}
      inputMode={calculatedInputMode}
      min={min}
      max={max}
      onFocus={onFocus}
      onBlur={onBlur}
      onChange={onValueChange}
    />
  );
}

export {
  MaskInput,
  MASK_PATTERNS,
  applyMask,
  applyCurrencyMask,
  applyPercentageMask,
  getUnmaskedValue,
  type MaskPattern,
  type MaskInputProps,
  type MaskPatternKey
};
