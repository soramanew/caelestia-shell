import { Binding, register } from "astal";
import { Astal, astalify, Gtk, Widget, type ConstructProps } from "astal/gtk3";
import AstalHyprland from "gi://AstalHyprland";

export const setupCustomTooltip = (self: any, text: string | Binding<string>) => {
    if (!text) return null;

    const window = new Widget.Window({
        visible: false,
        namespace: "caelestia-tooltip",
        layer: Astal.Layer.OVERLAY,
        keymode: Astal.Keymode.NONE,
        exclusivity: Astal.Exclusivity.IGNORE,
        anchor: Astal.WindowAnchor.TOP | Astal.WindowAnchor.LEFT,
        child: new Widget.Label({ className: "tooltip", label: text }),
    });
    self.set_tooltip_window(window);

    let dirty = true;
    let lastX = 0;
    self.connect("size-allocate", () => (dirty = true));
    window.connect("size-allocate", () => {
        const mWidth = AstalHyprland.get_default().get_focused_monitor().get_width();
        const pWidth = window.get_preferred_width()[1];

        let marginLeft = lastX + (self.get_allocated_width() - pWidth) / 2;
        if (marginLeft < 0) marginLeft = 0;
        else if (marginLeft + pWidth > mWidth) marginLeft = mWidth - pWidth;

        window.marginLeft = marginLeft;
    });
    if (text instanceof Binding) self.hook(text, (_: any, v: string) => !v && window.hide());

    self.connect("query-tooltip", (_: any, x: number, y: number) => {
        if (text instanceof Binding && !text.get()) return false;
        if (dirty) {
            const { width, height } = self.get_allocation();
            const mWidth = AstalHyprland.get_default().get_focused_monitor().get_width();
            const pWidth = window.get_preferred_width()[1];
            const { x: cx, y: cy } = AstalHyprland.get_default().get_cursor_position();

            let marginLeft = cx + ((width - pWidth) / 2 - x);
            if (marginLeft < 0) marginLeft = 0;
            else if (marginLeft + pWidth > mWidth) marginLeft = mWidth - pWidth;

            window.marginLeft = marginLeft;
            window.marginTop = cy + (height - y);
            lastX = cx - x;

            dirty = false;
        }
        return true;
    });

    self.connect("destroy", () => window.destroy());

    return window;
};

export const setupChildClickthrough = (self: any) =>
    self.connect("size-allocate", () => self.get_window()?.set_child_input_shapes());

@register()
export class MenuItem extends astalify(Gtk.MenuItem) {
    constructor(props: ConstructProps<MenuItem, Gtk.MenuItem.ConstructorProps, { onActivate: [] }>) {
        super(props as any);
    }
}

@register()
export class Calendar extends astalify(Gtk.Calendar) {
    constructor(props: ConstructProps<Calendar, Gtk.Calendar.ConstructorProps>) {
        super(props as any);
    }
}
