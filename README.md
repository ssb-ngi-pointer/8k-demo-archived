<!--
SPDX-FileCopyrightText: 2021 Anders Rune Jensen <arj03@protonmail.ch>

SPDX-License-Identifier: CC0-1.0
-->

:warning: **This repo was moved to https://github.com/ssbc/8k-demo.** This archival will remain in this GitHub org `ssb-ngi-pointer` to demonstrate the outcome of the work done by the SSB NGI Pointer team during 2020 and 2021. The SSB NGI Pointer team is no longer active because we completed our grant project.

# 8K demo

8K demo is an example SSB application made for the svendsolar event
running purely in the browser using [ssb-browser-core]. The aim of the
application is to showcase some of the things we have been building
during the ngi pointer grant.

You can try a [live demo].

![Screenshot of 8K demo][screenshot]

8K demo works by allowing users to create their own applications and
share these together with the data to other users connected to the
same [room]. The name 8k comes from the message size limit, meaning
applications can be no larger than 8192 bytes and demo refers to the
golden demoscene days were packing a ton of stuff into a tiny file was
an art in itself.

8K demo uses meta feeds to store information in different feeds. By
doing so allowing for partial replication by selectively downloading
the feeds of a peer you are interested in. By default a few feeds are
created denoted by their feedpurpose:

 - 8K/applications, for storing the actual applications
 - 8K/chat, for data related to the default chat application
 - replication, for communication about what feeds you know about
   similar to ssb-friends

Each application should create a feed to store the data related to the
application.

The apps folder contains a few sample applications one can use for
inspiration.

[screenshot]: screenshot.png
[ssb-browser-core]: https://github.com/arj03/ssb-browser-core
[room]: https://github.com/ssb-ngi-pointer/go-ssb-room/
[live demo]: https://8kdemo.between-two-worlds.dk/
