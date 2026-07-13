import { motion } from 'framer-motion';
import ProfileSettings from './settings/ProfileSettings';
import AppearanceSettings from './settings/AppearanceSettings';
import SoundSettings from './settings/SoundSettings';
import SyncSettings from './settings/SyncSettings';
import AIProviderSettings from './settings/AIProviderSettings';
import DataSettings from './settings/DataSettings';
import ModeSettings from './settings/ModeSettings';
import StoragePathSettings from './settings/StoragePathSettings';
import AboutSettings from './settings/AboutSettings';

export default function SettingsPage() {
  return (
    <motion.div
      className="flex flex-col h-full overflow-y-auto"
      initial="hidden"
      animate="visible"
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05, delayChildren: 0.06 } } }}
    >
      <motion.div
        className="px-kb-md py-kb-md"
        variants={{ hidden: { opacity: 0, y: -10, filter: 'blur(3px)' }, visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.35 } } }}
      >
        <h1 className="text-h1 font-semibold text-text-primary">设置</h1>
        <p className="text-b2 text-text-tertiary mt-0.5">个性化你的学习体验</p>
      </motion.div>

      <div className="flex-1 px-kb-md pb-kb-lg space-y-kb-md max-w-2xl w-full mx-auto">
        <ProfileSettings />
        <AppearanceSettings />
        <SoundSettings />
        <ModeSettings />
        <SyncSettings />
        <AIProviderSettings />
        <DataSettings />
        <StoragePathSettings />
        <AboutSettings />
      </div>
    </motion.div>
  );
}

