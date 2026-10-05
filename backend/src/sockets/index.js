export function configureSockets(io, auth) {
  io.use(auth.socket);
  io.on("connection", (socket) => {
    socket.join(`user:${socket.user._id}`);
    if (["admin", "operator"].includes(socket.user.role)) socket.join("staff");
    // The signed session lasts eight hours. Reconnection revalidates it.
    const expiry = setTimeout(
      () => socket.disconnect(true),
      Math.max(0, socket.sessionExpiresAt - Date.now()),
    );
    socket.on("disconnect", () => clearTimeout(expiry));
  });
  return {
    staff(event, data) {
      io.to("staff").emit(event, data);
    },
    job(event, job) {
      io.to("staff").to(`user:${job.customer}`).emit(event, job);
    },
    order(order) {
      io.to("staff").to(`user:${order.customer}`).emit("order:status", order);
    },
    disconnectUser(id) {
      io.in(`user:${id}`).disconnectSockets(true);
    },
  };
}
