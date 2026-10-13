import { FontType, FontChoices } from "./FontType";
import { ConfigGroup, ConfigItem } from "./ConfigItem";

export const SidebarMode = { Docked: "docked", Overlay: "overlay" } as const;
export type SidebarModeValue = (typeof SidebarMode)[keyof typeof SidebarMode];

/**
 * The client's own settings, RuneLite's `RuneLiteConfig` (group `runelite`, which also holds
 * each plugin's on/off key). The plugin hub opens them from its pinned client row.
 */
export const RuneLiteConfig = ConfigGroup("runelite", {
    dynamicOverlayFont:ConfigItem({keyName:"fontType",name:"Overlay font",description:"Font used for overlays such as tile labels.",enum:FontChoices,default:FontType.SMALL,position:1}),
    tooltipFont:ConfigItem({keyName:"tooltipFontType",name:"Tooltip font",description:"Font used for hover tooltips.",enum:FontChoices,default:FontType.SMALL,position:2}),
    interfaceFont:ConfigItem({keyName:"interfaceFontType",name:"Interface font",description:"Font used for panel overlays.",enum:FontChoices,default:FontType.REGULAR,position:3}),
    infoboxFont:ConfigItem({keyName:"infoboxFontType",name:"Infobox font",description:"Font used for infoboxes.",enum:FontChoices,default:FontType.REGULAR,position:4}),
    sidebarMode: ConfigItem<SidebarModeValue>({
        keyName: "sidebarMode",
        name: "Sidebar panels",
        description:
            "Docked: panels open beside the game, which narrows to make room. Overlay: panels open over the game.",
        enum: SidebarMode,
        default: SidebarMode.Overlay,
        position: 0,
    }),
});
