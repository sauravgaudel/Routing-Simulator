

const PacketFlow = (() => {

  async function run(source, destination, message) {
    UI.setSendBusy(true);
    UI.showTransmissionBanner("Preparing transmission…", "active");

    let result;
    try {
      result = await API.send(source, destination, message);
    } catch (err) {
      UI.toast(err.message || "Transmission failed.", "error");
      UI.hideTransmissionBanner();
      UI.setSendBusy(false);
      return;
    }

    UI.renderAsciiSteps(result.ascii_steps || []);
    UI.renderFullBinary(result.full_binary || "");

    if (!result.success) {
      UI.toast(result.reason || "No path available between those routers.", "error");
      UI.renderPacketDetails([]);
      UI.hideTransmissionBanner();
      UI.setSendBusy(false);
      await App.refreshAll();
      return;
    }

    UI.renderPacketDetails(result.packets);
    UI.renderTransmissionStatus(result.path);
    NetworkView.highlightPath(result.path);
    UI.showTransmissionBanner(`Transmitting ${source} → ${destination}`, "active");

    for (const packet of result.packets) {
      await deliverPacket(packet, destination);
    }

    UI.showTransmissionBanner(`Delivered to ${destination} ✓`, "success");
    UI.toast(`Message delivered. Reassembled: "${result.reassembled_message}"`, "success");
    NetworkView.resetAllRouterStates();

    setTimeout(() => {
      NetworkView.clearHighlight();
      UI.hideTransmissionBanner();
    }, 1400);

    UI.setSendBusy(false);
    await App.refreshAll();
  }

  async function deliverPacket(packet, finalDestination) {
    let path = packet.path.slice();
    let index = 0;
    let hops = 0;
    const maxHops = 24;

    UI.setPacketState(packet.packet_id, "transit");

    while (index < path.length - 1 && hops < maxHops) {
      hops++;
      const from = path[index];
      const to = path[index + 1];
      const link = App.findLink(from, to);

      if (!link || link.status === "down") {
        UI.showTransmissionBanner("Link failure detected — rerouting…", "error");
        UI.logLocal("Failure Detected", `Link ${from} -> ${to} is unavailable. Recomputing route with Dijkstra...`);
        UI.toast(`Link failure on ${from} → ${to}. Rerouting...`, "error");
        NetworkView.pulseRouter(from, "Rerouting…");
        await Anim.wait(1100); // visible "pause" beat before the reroute lands

        let reroute;
        try {
          reroute = await API.route(from, finalDestination);
        } catch (err) {
          UI.setPacketState(packet.packet_id, "lost");
          UI.hideTransmissionBanner();
          return;
        }

        if (!reroute.reachable) {
          UI.logLocal("Transmission Failed", `No alternate path from ${from} to ${finalDestination}.`);
          UI.toast("No alternate path available. Packet lost.", "error");
          UI.setPacketState(packet.packet_id, "lost");
          UI.hideTransmissionBanner();
          return;
        }

        path = reroute.path;
        index = 0;
        NetworkView.highlightPath(path);
        UI.renderTransmissionStatus(path);
        UI.showTransmissionBanner(`Rerouted via ${path.join(" → ")}`, "active");
        continue;
      }

      const isLastHop = index + 2 === path.length;

      // FORWARDING at the sending router
      NetworkView.setRouterState(from, "forwarding", "Forwarding…");
      NetworkView.pulseRouter(from, "Forwarding…");
      NetworkView.setLinkActiveFlow(from, to, true);

      const posA = NetworkView.getRouterPosition(from);
      const posB = NetworkView.getRouterPosition(to);
      if (posA && posB) {
        await Anim.animateBinaryAcrossLink(
          NetworkView.getPacketLayer(),
          packet.binary,
          posA.x, posA.y, posB.x, posB.y,
          2200
        );
      }
      NetworkView.setLinkActiveFlow(from, to, false);
      NetworkView.setRouterState(from, "idle");

      // RECEIVING at the next hop
      NetworkView.setRouterState(to, "receiving", "Receiving…");
      NetworkView.pulseRouter(to, "Receiving…");
      await Anim.wait(650);

      // PROCESSING
      NetworkView.setRouterState(to, "processing", "Processing…");
      await Anim.wait(650);

      UI.updateTransmissionProgress(path, index + 1);

      if (!isLastHop) {
        NetworkView.setRouterState(to, "idle");
        await Anim.wait(300); // brief settle before the next hop starts
      } else {
        NetworkView.pulseRouter(to, "Delivered ✓");
        await Anim.wait(500);
        NetworkView.setRouterState(to, "idle");
      }

      index++;
    }

    UI.setPacketState(packet.packet_id, "delivered");
  }

  return { run };
})();
