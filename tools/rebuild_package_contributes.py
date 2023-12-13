"""
WiP.

Soon.
"""

# region [Imports]

import os
import re
import sys
import json
import dataclasses
import shutil

from pathlib import Path

from typing import (TYPE_CHECKING, TypeVar, TypeGuard, TypeAlias, Final, TypedDict, Generic, Union, Optional, ForwardRef, final, Callable,
                    no_type_check, no_type_check_decorator, overload, get_type_hints, cast, Protocol, runtime_checkable, NoReturn, NewType, Literal, AnyStr, IO, BinaryIO, TextIO, Any)


if TYPE_CHECKING:
    ...

# endregion [Imports]

# region [TODO]


# endregion [TODO]

# region [Logging]


# endregion [Logging]

# region [Constants]

THIS_FILE_DIR = Path(__file__).parent.absolute()

# endregion [Constants]

PACKAGE_JSON_PATH = Path.cwd().joinpath("package.json").resolve()


def main() -> int:
    if not PACKAGE_JSON_PATH.exists():
        raise FileNotFoundError(f"'package.json' does not exist in {str(PACKAGE_JSON_PATH.parent)!r}.")


# region [Main_Exec]

if __name__ == '__main__':
    pass

# endregion [Main_Exec]
