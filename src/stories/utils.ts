export const enumOptions = (someEnum:any) => {
    return {
        options: Object.values(someEnum),
        mapping: someEnum,
        control: {
            type: "select",
            labels: Object.keys(someEnum)
        },
    }
}
