import { NativeTabs } from "expo-router/native-tabs";

// md = Material Symbols on Android, sf = SF Symbols on iOS (no image files needed)
export default function TabsLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon md="qr_code_scanner" sf="qrcode.viewfinder" />
        <NativeTabs.Trigger.Label>Сканер</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Icon md="receipt_long" sf="list.bullet.rectangle" />
        <NativeTabs.Trigger.Label>История</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon md="settings" sf="gearshape" />
        <NativeTabs.Trigger.Label>Настройки</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
