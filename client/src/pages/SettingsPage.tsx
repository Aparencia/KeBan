import ProfileSettings from './settings/ProfileSettings';
import AppearanceSettings from './settings/AppearanceSettings';
import SoundSettings from './settings/SoundSettings';
import SyncSettings from './settings/SyncSettings';
import AIProviderSettings from './settings/AIProviderSettings';
import DataSettings from './settings/DataSettings';
import AboutSettings from './settings/AboutSettings';

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-kb-md py-kb-md">
        <h1 className="text-h1 font-semibold text-text-primary">设置</h1>
        <p className="text-b2 text-text-tertiary mt-0.5">个性化你的学习体验</p>
      </div>

      <div className="flex-1 px-kb-md pb-kb-lg space-y-kb-md max-w-2xl w-full mx-auto">
        <ProfileSettings />
        <AppearanceSettings />
        <SoundSettings />
        <SyncSettings />
        <AIProviderSettings />
        <DataSettings />
        <AboutSettings />
      </div>
    </div>
  );
}
