import { useId } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CalendarLocation } from '@/lib/business-calendar';

type LocationOption = { code: string; name: string; timeZoneId?: string };
type Props = { value: CalendarLocation; onChange: (value: CalendarLocation) => void; disabled?: boolean; required?: boolean; showHeading?: boolean };
const input = 'min-h-11 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-600 disabled:bg-slate-50 disabled:text-slate-500';
const zones = ['America/Sao_Paulo', 'America/Fortaleza', 'America/Recife', 'America/Bahia', 'America/Belem', 'America/Maceio', 'America/Araguaina', 'America/Cuiaba', 'America/Campo_Grande', 'America/Manaus', 'America/Porto_Velho', 'America/Boa_Vista', 'America/Rio_Branco', 'America/Eirunepe', 'America/Santarem', 'America/Noronha'];
const zoneByState: Record<string, string> = { AC: 'America/Rio_Branco', AL: 'America/Maceio', AM: 'America/Manaus', AP: 'America/Belem', BA: 'America/Bahia', CE: 'America/Fortaleza', MA: 'America/Fortaleza', MT: 'America/Cuiaba', MS: 'America/Campo_Grande', PA: 'America/Belem', PB: 'America/Fortaleza', PE: 'America/Recife', PI: 'America/Fortaleza', RN: 'America/Fortaleza', RO: 'America/Porto_Velho', RR: 'America/Boa_Vista', SE: 'America/Maceio', TO: 'America/Araguaina' };

/** Public geographic catalogs also work while signed in only to the platform. */
export function CalendarLocationFields({ value, onChange, disabled, required = true, showHeading = true }: Props) {
  const id = useId();
  const states = useQuery({ queryKey: ['locations', 'states'], queryFn: () => api.get<{ items: LocationOption[] }>('/api/v1/locations/states', { anonymous: true }), staleTime: 86_400_000 });
  const cities = useQuery({ queryKey: ['locations', 'cities', value.stateCode], queryFn: () => api.get<{ items: LocationOption[] }>(`/api/v1/locations/states/${encodeURIComponent(value.stateCode ?? '')}/cities`, { anonymous: true }), enabled: !!value.stateCode, staleTime: 86_400_000 });
  const selectedCityMissing = !!value.cityCode && !cities.data?.items.some(city => city.code === value.cityCode);
  return <fieldset disabled={disabled} className="min-w-0 space-y-3">
    <legend className={showHeading ? "text-sm font-semibold text-slate-900" : "sr-only"}>Localização do ambiente</legend>
    {showHeading && <p className="text-sm leading-6 text-slate-600">A cidade e o estado identificam os feriados usados nos próximos cálculos de horas úteis. A localização e o calendário valem somente para este ambiente.</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      <label htmlFor={`${id}-state`} className="space-y-1 text-sm font-medium text-slate-700"><span>Estado</span><select id={`${id}-state`} required={required} className={input} value={value.stateCode ?? ''} disabled={disabled || states.isLoading || states.isError} onChange={event => {
        const stateCode = event.target.value;
        onChange({ ...value, stateCode, cityCode: '', cityName: '', timeZoneId: stateCode ? zoneByState[stateCode] ?? 'America/Sao_Paulo' : '' });
      }}><option value="">{states.isLoading ? 'Carregando estados…' : 'Selecione o estado'}</option>{value.stateCode && !states.data?.items.some(state => state.code === value.stateCode) && <option value={value.stateCode}>{value.stateCode}</option>}{states.data?.items.map(state => <option key={state.code} value={state.code}>{state.name} ({state.code})</option>)}</select></label>
      <label htmlFor={`${id}-city`} className="space-y-1 text-sm font-medium text-slate-700"><span>Município</span><select id={`${id}-city`} required={required} className={input} value={value.cityCode ?? ''} disabled={disabled || !value.stateCode || cities.isLoading || cities.isError} onChange={event => {
        const city = cities.data?.items.find(item => item.code === event.target.value);
        onChange({ ...value, cityCode: city?.code ?? '', cityName: city?.name ?? '', timeZoneId: city?.timeZoneId ?? (city?.code === '2605459' ? 'America/Noronha' : value.timeZoneId) });
      }}><option value="">{cities.isLoading && value.stateCode ? 'Carregando municípios…' : 'Selecione o município'}</option>{selectedCityMissing && <option value={value.cityCode ?? ''}>{value.cityName || value.cityCode}</option>}{cities.data?.items.map(city => <option key={city.code} value={city.code}>{city.name}</option>)}</select></label>
      <label htmlFor={`${id}-zone`} className="space-y-1 text-sm font-medium text-slate-700 sm:col-span-2"><span>Fuso horário</span><select id={`${id}-zone`} required={required} className={input} value={value.timeZoneId ?? ''} onChange={event => onChange({ ...value, timeZoneId: event.target.value })}><option value="">Selecione o fuso horário</option>{value.timeZoneId && !zones.includes(value.timeZoneId) && <option value={value.timeZoneId}>{value.timeZoneId}</option>}{zones.map(zone => <option key={zone} value={zone}>{zone.replace('America/', '').replaceAll('_', ' ')} ({zone})</option>)}</select><span className="block text-xs font-normal leading-5 text-slate-600">Sugerido pela localização. Confira o fuso do município, especialmente em estados com mais de um fuso. Os horários independem do fuso de quem acessa o sistema.</span></label>
    </div>
    {(states.isError || cities.isError) && <p role="alert" className="text-sm text-red-700">Não foi possível carregar {states.isError ? 'os estados' : 'os municípios'}. <button type="button" className="min-h-10 underline underline-offset-4" onClick={() => void (states.isError ? states.refetch() : cities.refetch())}>Tentar novamente</button></p>}
  </fieldset>;
}
