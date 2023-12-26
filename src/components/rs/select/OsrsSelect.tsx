import { memo } from "react";
import Select, { GroupBase, OptionProps, Props, components, createFilter } from "react-select";

import "./OsrsSelect.css";

function OsrsSelectOption<Option, IsMulti extends boolean, Group extends GroupBase<Option>>({
    children,
    ...props
}: OptionProps<Option, IsMulti, Group>) {
    const { onMouseMove, onMouseOver, ...rest } = props.innerProps;
    const newProps = { ...props, innerProps: rest };
    return <components.Option {...newProps}>{children}</components.Option>;
}

export const OsrsSelect = memo(function OsrsSelect<
    Option,
    IsMulti extends boolean = false,
    Group extends GroupBase<Option> = GroupBase<Option>,
>(props: Props<Option, IsMulti, Group>) {
    return (
        <Select
            {...props}
            menuPlacement="auto"
            placeholder="Search"
            filterOption={createFilter({ ignoreAccents: false })}
            components={{
                DropdownIndicator: () => null,
                IndicatorSeparator: () => null,
                Option: OsrsSelectOption,
            }}
            classNames={{
                container: (state) => "osrs-select-container",
                control: (state) => "osrs-select-control",
                valueContainer: (state) => "osrs-select-value-container",
                input: (state) => "osrs-select-input",
                singleValue: (state) => "osrs-select-single-value",
                placeholder: (state) => "osrs-select-placeholder",
                menu: (state) => "osrs-select-menu",
                menuList: (state) => "osrs-select-menu-list",
                option: (state) => "osrs-select-option",
                noOptionsMessage: (state) => "osrs-select-no-options-message",
            }}
            theme={(theme) => ({
                ...theme,
                borderRadius: 0,
                colors: {
                    ...theme.colors,
                    primary75: "#787169",
                    primary50: "#787169",
                    // hover
                    primary25: "#787169",
                    // selected
                    primary: "#787169",
                    // normal
                    neutral0: "#3e3529",
                },
            })}
        />
    );
});
