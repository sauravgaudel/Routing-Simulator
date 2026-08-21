"""
packet.py
---------
Turns a plain text message into one or more Packet objects, each
carrying a chunk of the message plus its binary representation.
"""

from typing import List

from models import Packet, PacketStatus
from utils import char_to_binary, id_generator

# Number of characters carried by a single packet's payload.
PACKET_CHUNK_SIZE = 4


class PacketBuilder:
    """Splits a message into packets and encodes each chunk as binary."""

    @staticmethod
    def build(message: str, source: str, destination: str) -> List[Packet]:
        if not message:
            return []

        chunks = [
            message[i:i + PACKET_CHUNK_SIZE]
            for i in range(0, len(message), PACKET_CHUNK_SIZE)
        ]
        total = len(chunks)
        packets: List[Packet] = []

        for index, chunk in enumerate(chunks):
            binary = "".join(char_to_binary(ch) for ch in chunk)
            packet = Packet(
                packet_id=id_generator.next("PKT"),
                sequence=index + 1,
                total=total,
                payload=chunk,
                binary=binary,
                source=source,
                destination=destination,
                status=PacketStatus.CREATED,
            )
            packets.append(packet)

        return packets

    @staticmethod
    def reassemble(packets: List[Packet]) -> str:
        """Reassembles packets (already in sequence order) back into text."""
        ordered = sorted(packets, key=lambda p: p.sequence)
        return "".join(p.payload for p in ordered)