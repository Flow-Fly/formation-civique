import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Sun, Moon, Database, AlertTriangle, Download, Upload } from "lucide-react";
import { useTheme } from "@/context/theme-context.tsx";
import * as storage from "@/services/storage.ts";
import type { Settings } from "@/types/index.ts";

function getSettings(): Settings {
  return storage.load<Settings>("settings", { darkMode: false, dailyGoal: 20 });
}

export function SettingsPage() {
  const { isDark, toggle } = useTheme();
  const [settings, setSettings] = useState(getSettings);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleDailyGoalChange(value: string) {
    const newSettings = { ...settings, dailyGoal: parseInt(value, 10) };
    setSettings(newSettings);
    storage.save("settings", newSettings);
  }

  function handleExport() {
    const data = storage.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `formation-civique-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        storage.importAll(data);
        alert("Progression importee avec succes !");
        setSettings(getSettings());
      } catch {
        alert("Fichier invalide.");
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be imported again
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleReset() {
    storage.clearAll();
    setShowResetDialog(false);
    alert("Donnees reinitialisees.");
    setSettings(getSettings());
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Parametres</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            Affichage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Mode sombre</span>
            <Switch checked={isDark} onCheckedChange={toggle} />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">
              Objectif quotidien (cartes)
            </label>
            <Select
              value={String(settings.dailyGoal)}
              onValueChange={handleDailyGoalChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="30">30</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Donnees
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" className="w-full active-scale" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1.5" />
            Exporter la progression (JSON)
          </Button>
          <Button
            variant="outline"
            className="w-full active-scale"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4 mr-1.5" />
            Importer une progression
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Zone de danger
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="destructive"
            className="w-full active-scale"
            onClick={() => setShowResetDialog(true)}
          >
            Reinitialiser toutes les donnees
          </Button>
          <p className="text-sm text-muted-foreground">
            Cette action est irreversible. Toute votre progression sera perdue.
          </p>
        </CardContent>
      </Card>

      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la reinitialisation</DialogTitle>
            <DialogDescription>
              Toute votre progression sera supprimee. Cette action est irreversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleReset}>
              Reinitialiser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
