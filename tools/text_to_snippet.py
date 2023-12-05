"""

"""

# region [Imports]

import textwrap
from pathlib import Path
import sys
# endregion [Imports]

# region [TODO]


# endregion [TODO]

# region [Logging]


# endregion [Logging]

# region [Constants]

THIS_FILE_DIR = Path(__file__).parent.absolute()

# endregion [Constants]


TEXT = """
/*
Maintainer: Maria Martinez, James Johnson
    Calculates the logarithmic mean of the arguments.
    Places a marker on the map where Petros is not standing.
    Finally, concludes whether the player will win the next lottery.

Arguments:
    <STRING> The first argument
    <OBJECT> The second argument
    <SCALAR> Float or number in SQF.
    <INTEGER> If the number cannot have fractional values.
    <BOOL> Optional input (default: true)
    <ARRAY<STRING>> Array of a specific type (string in this case).
    <STRING,ANY> A key-pair as compound type, shorthand by omitting ARRAY.
    <CODE|STRING> Optional input with synonymous types, string compiles into code. (default: {true})
    <STRING> Optional singular String input | <ARRAY> Optional Array input (default: [""])
    <CODE<OBJECT,SCALAR,SCALAR,STRING>> Code that takes arguments of an object, a scalar, a scalar, and returns a string.

Return Value:
    <BOOL> If the player will win the next lottery.

Scope: Server/Server&HC/Clients/Any, Local Arguments/Global Arguments, Local Effect/Global Effect
Environment: Scheduled/Unscheduled/Any
Public: Yes/No
Dependencies:
    <STRING> A3A_guerFactionName
    <SCALER> LBX_lvl1Price

Example:
    ["something", player, 2.718281828, 4, nil, ["Tom","Dick","Harry"], ["UID123Money",0], "hint ""Hello World!\"""] call A3A_fnc_standardizedHeader; // false
*/

""".strip()


def main(in_text: str) -> str:
    text_lines = in_text.splitlines()

    snippet_body = '['
    for line in text_lines:
        line = line.replace('"', '\\"')
        snippet_body += f'"{line}", \n'

    snippet_body = snippet_body.removesuffix(", \n")
    snippet_body += "]"

    print(snippet_body)
# region [Main_Exec]


if __name__ == '__main__':
    if len(sys.argv) <= 1:
        print("no text provided!")
        sys.exit(-1)

    if len(sys.argv) >= 3:
        print("too many arguments, please only provide one argument!")
        sys.exit(-1)
    text = sys.argv[1]

    if Path(text).is_file():
        text = Path(text).read_text(encoding='utf-8', errors='ignore')

    main(text)
    sys.exit(1)

# endregion [Main_Exec]
