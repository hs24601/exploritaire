export type TextEffectId =
  | 'none'
  | 'disassembled'
  | 'float_away'
  | 'shimmer'
  | 'fog_out'
  | 'barrage_text'
  | 'double_cut'
  | 'frost'
  | 'combo_punch'
  | 'petrified'
  | 'thanos_dismantle';

export type TextPreset = {
  id: TextEffectId;
  label: string;
  category: 'text';
};

export const TEXT_PRESETS: TextPreset[] = [
  { id: 'none', label: 'None', category: 'text' },
  { id: 'disassembled', label: 'Disassembled', category: 'text' },
  { id: 'float_away', label: 'Float Away', category: 'text' },
  { id: 'shimmer', label: 'Shimmer', category: 'text' },
  { id: 'fog_out', label: 'Fog Out', category: 'text' },
  { id: 'barrage_text', label: 'Barrage Text', category: 'text' },
  { id: 'double_cut', label: 'Double Cut', category: 'text' },
  { id: 'frost', label: 'Frost', category: 'text' },
  { id: 'combo_punch', label: 'Combo Punch', category: 'text' },
  { id: 'petrified', label: 'Petrified', category: 'text' },
  { id: 'thanos_dismantle', label: 'Thanos Dismantle', category: 'text' },
];
