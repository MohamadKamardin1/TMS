package com.amdevelopers.tms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "customer_profiles")
@EntityListeners(AuditingEntityListener.class)
public class CustomerProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "address", length = 255)
    private String address;

    @Column(name = "cnic", length = 20)
    private String cnic;

    @Column(name = "lambai", length = 20)
    private String lambai;

    @Column(name = "asteen", length = 20)
    private String asteen;

    @Column(name = "teera", length = 20)
    private String teera;

    @Column(name = "chest", length = 20)
    private String chest;

    @Column(name = "collar_ban_size", length = 20)
    private String collarBanSize;

    @Column(name = "collar_ban_width", length = 20)
    private String collarBanWidth;

    @Column(name = "khulla", length = 20)
    private String khulla;

    @Column(name = "shalwar", length = 20)
    private String shalwar;

    @Column(name = "panja", length = 20)
    private String panja;

    @Column(name = "daman", length = 20)
    private String daman;

    @Column(name = "front_pocket_size")
    private Integer frontPocketSize;

    @Column(name = "side_pockets")
    private Integer sidePockets;

    @Column(name = "front_pati")
    private Boolean frontPati;

    @Column(name = "kaaf")
    private Boolean kaaf;

    @Column(name = "shalwar_pocket")
    private Boolean shalwarPocket;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "customer")
    @Builder.Default
    private List<Order> orders = new ArrayList<>();
}