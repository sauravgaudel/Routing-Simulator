"""
utils.py
--------
Small, reusable helper functions used across the backend:
- geometry (distance / cost calculation)
- ASCII <-> Binary conversion helpers
- timestamp helper for the event log
- simple id generator
"""

import math
import time
import itertools
from typing import List, Dict


# ----------------------------------------------------------------------
# ID GENERATION
# ----------------------------------------------------------------------
class IdGenerator:
    """Generates simple, human-readable, incrementing ids with a prefix."""

    def __init__(self) -> None:
        self._counters: Dict[str, itertools.count] = {}

    def next(self, prefix: str) -> str:
        if prefix not in self._counters:
            self._counters[prefix] = itertools.count(1)
        return f"{prefix}{next(self._counters[prefix])}"


id_generator = IdGenerator()


# ----------------------------------------------------------------------
# GEOMETRY / COST
# ----------------------------------------------------------------------
def euclidean_distance(x1: float, y1: float, x2: float, y2: float) -> float:
    """Straight line distance between two points."""
    return math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)


def distance_to_cost(distance: float) -> float:
    """
    Converts a raw pixel distance into a routing 'cost'.
    Kept as a separate function so the cost formula can be tuned
    in a single place without touching graph logic.
    """
    return round(distance / 10.0, 2)


# ----------------------------------------------------------------------
# ASCII <-> BINARY
# ----------------------------------------------------------------------
def char_to_binary(ch: str) -> str:
    """Convert a single character to an 8-bit zero padded binary string."""
    return format(ord(ch), "08b")


def ascii_to_binary_steps(message: str) -> List[Dict[str, str]]:
    """
    Returns a step-by-step breakdown of the ASCII -> Binary conversion,
    one entry per character, e.g.:
        {"char": "H", "ascii": 72, "binary": "01001000"}
    """
    steps = []
    for ch in message:
        steps.append({
            "char": ch,
            "ascii": ord(ch),
            "binary": char_to_binary(ch),
        })
    return steps


def message_to_binary_stream(message: str) -> str:
    """Concatenates the binary representation of every character."""
    return "".join(char_to_binary(ch) for ch in message)


def binary_to_ascii(binary: str) -> str:
    """Converts an 8-bit-aligned binary string back into text."""
    chars = []
    for i in range(0, len(binary), 8):
        byte = binary[i:i + 8]
        if len(byte) == 8:
            chars.append(chr(int(byte, 2)))
    return "".join(chars)


# ----------------------------------------------------------------------
# TIME
# ----------------------------------------------------------------------
def timestamp() -> str:
    """HH:MM:SS timestamp used in the event log."""
    return time.strftime("%H:%M:%S")