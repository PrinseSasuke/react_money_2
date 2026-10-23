// Account and category on the receipt card (ТЗ: «выбор счёта (по умолчанию — последний); категория — по желанию»).
import { ScrollView, Pressable, Text, View } from "react-native";
import { EXPENSE_CATEGORIES } from "@react-money/shared";
import { useAccounts } from "@/lib/accounts";

export interface ChoiceValue {
  accountId: string | null;
  category: string | null;
}

export function ChoicePicker({ value, onChange }: { value: ChoiceValue; onChange: (v: ChoiceValue) => void }) {
  const accounts = useAccounts();
  // a saved account that no longer exists falls back to the default one
  const known = accounts.data?.some((a) => a.id === value.accountId) ?? true;
  const accountId = known ? value.accountId : null;

  return (
    <View>
      <Text className="mt-6 text-sm text-neutral-500">Счёт</Text>
      {accounts.isError ? (
        <Text className="mt-1 text-base text-neutral-500">Нет связи — чек уйдёт на счёт по умолчанию</Text>
      ) : (
        <Chips>
          <Chip label="По умолчанию" active={accountId === null} onPress={() => onChange({ ...value, accountId: null })} />
          {(accounts.data ?? []).map((a) => (
            <Chip key={a.id} label={a.name} active={accountId === a.id} onPress={() => onChange({ ...value, accountId: a.id })} />
          ))}
        </Chips>
      )}

      <Text className="mt-4 text-sm text-neutral-500">Категория</Text>
      <Chips>
        {EXPENSE_CATEGORIES.map((c) => (
          <Chip
            key={c}
            label={c}
            active={value.category === c}
            onPress={() => onChange({ ...value, category: value.category === c ? null : c })}
          />
        ))}
      </Chips>
    </View>
  );
}

function Chips({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2 -mx-6" contentContainerClassName="px-6 gap-2">
      {children}
    </ScrollView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={`rounded-full px-4 py-2 ${active ? "bg-brand" : "bg-neutral-200 dark:bg-neutral-800"}`}
    >
      <Text className={`text-base ${active ? "font-semibold text-white" : "text-black dark:text-white"}`}>{label}</Text>
    </Pressable>
  );
}
